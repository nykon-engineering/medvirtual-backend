# Migração Lambda → EC2: ambiente de PRODUÇÃO

**Ambiente**: PROD · **Instância**: `i-0575587874b69c931` · **IP**: `32.192.106.103`
**Situação**: infraestrutura provisionada em 2026-08-21; deploy automatizado configurado, aguardando primeira validação de tráfego real.

> Este documento é o irmão do [`lambda-to-ec2-migration.md`](./lambda-to-ec2-migration.md) (ambiente DEV). As duas migrações avançam **de forma independente** — trilhas, credenciais e instâncias separadas. Consulte o doc de DEV para o histórico de como o padrão foi validado antes de ser replicado aqui.

Este documento tem três partes:
- **Parte A** — o que já está provisionado (referência para a equipe)
- **Parte B** — checklist de validação pós-migração (para conferir que tudo voltou a funcionar)
- **Parte C** — deploy automatizado via GitHub Actions (branch `main`)

---

# PARTE A — Ambiente provisionado

## A1. Recursos criados na AWS

| Recurso | ID / Valor |
|---|---|
| Perfil AWS local | `medvirtual` (conta `920372998442`, us-east-1) |
| Instância EC2 | `i-0575587874b69c931` — t4g.medium, arm64 (Graviton) |
| Elastic IP (fixo) | `32.192.106.103` |
| Key pair | `medvirtual-ec2-prod` — **dedicada a prod**, não reaproveita a de dev/staging |
| Security group (app) | `sg-0c766b21fdaecbe82` (`SG-PROD-BACKEND-EC2`) |
| AMI | `ami-09317ccfac89b432d` (Amazon Linux 2023, kernel 6.1, arm64) — mesma imagem usada em dev |
| IAM role da instância | `MedVirtualBackendEC2-PROD-role` (instance profile de mesmo nome) |
| VPC | `vpc-03eaf7de79db5a1ef` — **diferente da VPC de dev** (`vpc-0a86b29ec09c1a424`); é a mesma VPC onde roda a Lambda `MedVirtualBackendNest-PROD` |
| Subnet | `subnet-0dba2e8c322ac1998` (pública, us-east-1a, via IGW `igw-05371d518aebea565`) |
| RDS de destino | `proddatabase` (`sg-02272f76fe832ecca` / `SG-PROD-RDS`) — porta 5432 liberada para `sg-0c766b21fdaecbe82` |

Disco: 30 GB gp3 criptografado. IMDSv2 obrigatório. Swap: 4 GB (swapfile, configurado via user-data no boot, persistido em `/etc/fstab`).

## A2. Por que uma VPC diferente da de dev

A VPC de prod (`vpc-03eaf7de79db5a1ef`) tem subnets **privadas** (onde a Lambda-PROD roda, saída via NAT Gateway `nat-0cb23d3b677682a6d`) e subnets **públicas** (via IGW). A EC2 foi colocada na subnet pública `subnet-0dba2e8c322ac1998` — precisa de IP público/Elastic IP para o GitHub Actions runner conseguir alcançar via SSH, o mesmo racional aplicado em dev, só que dentro da VPC de prod em vez de compartilhar a de dev.

## A3. IAM role da instância — resolvida desde o início

Diferente de dev (onde a ausência de instance profile foi um bloqueante descoberto só depois do provisionamento — ver pendência A5.1 do doc de dev), aqui a role foi criada **antes** da instância, espelhando as permissões de negócio da role da Lambda-PROD (`MedVirtualBackendNest-PROD-role-z610esfy`):

| Policy | Tipo | Escopo |
|---|---|---|
| `AmazonS3FullAccess` | Gerenciada | Igual à Lambda-PROD |
| `AmazonTextractFullAccess` | Gerenciada | Igual à Lambda-PROD |
| `SendMessageToDealQueueProd` | Inline | SQS em `deal-processing-queue-prod` — **mais permissiva que a da Lambda**: além de `SendMessage`, inclui `ReceiveMessage`, `DeleteMessage`, `GetQueueAttributes`, previendo o cenário do worker (`lambda-sqs.ts`) rodar por polling nesta EC2 no futuro (ver C4) |

**Não copiada**: a policy inline `LambdaVPCAccess` da role da Lambda (gerência de ENI) — é específica do modelo de Lambda-em-VPC e não se aplica a uma instância EC2.

## A4. Software instalado e verificado

| Software | Versão |
|---|---|
| Node.js | v22.23.1 (pacote `nodejs22` do AL2023) |
| npm | 10.9.8 |
| PM2 | 7.0.3 (`pm2 startup systemd` configurado e habilitado) |
| nginx | ativo (config padrão, sem proxy configurado ainda) |
| psql (client) | 15.18 |
| git | 2.50.1 |
| fail2ban | ativo |

**2 vCPU, 3,7 GB RAM utilizáveis + 4 GB de swap** (mesmo dimensionamento de dev — já parte de `t4g.medium`, sem precisar do resize que ocorreu lá).

## A5. Rede

| Porta | Origem | Uso |
|---|---|---|
| 22 | `0.0.0.0/0` | SSH (só chave; senha e root desativados por padrão da AMI, fail2ban ativo). **Mesma decisão de dev** — restringir a um IP/CIDR fixo é uma melhoria futura, não bloqueante. |
| 80 / 443 | `0.0.0.0/0` | HTTP/HTTPS público — ainda sem nginx configurado como proxy |
| 3000 | fechada | App — deve ser exposta via proxy reverso do nginx |

**Banco**: acesso ao RDS `proddatabase` liberado via security group (`sg-0c766b21fdaecbe82` → `SG-PROD-RDS`, porta 5432). Testado — conectividade TCP confirmada da instância ao endpoint `proddatabase.c4jaia8eq2w7.us-east-1.rds.amazonaws.com`.

## A6. Acesso

```bash
chmod 600 ~/.ssh/medvirtual-ec2-prod.pem      # obrigatório, senão o SSH recusa
ssh -i ~/.ssh/medvirtual-ec2-prod.pem ec2-user@32.192.106.103
```

Fingerprint esperado do host: `SHA256:W4XTiTRgK+583Zi5ufMYQI6PNrrucSp8gLWSjXgk+iQ`

## A7. Pendências antes do deploy real de tráfego

1. ~~**`.env`**~~ — **resolvido em 2026-08-21**: copiado para `/home/ec2-user/medvirtual-backend/.env` (permissão `600`), gerado a partir das 37 env vars da Lambda `MedVirtualBackendNest-PROD` (`aws lambda get-function-configuration`). A pipeline **nunca** gerencia esse arquivo (ver C2) — qualquer rotação de segredo precisa ser feita manualmente aqui também, não só na Lambda.
2. **nginx como proxy reverso** para `localhost:3000` — não configurado.
3. **HTTPS** — sem certificado (Let's Encrypt ou ACM + ALB).
4. ~~**Repository secrets `PROD_*`**~~ — **resolvido em 2026-08-21**: os três secrets (`PROD_SERVER_SSH_KEY`, `PROD_SERVER_HOST`, `PROD_SERVER_USER`) foram criados como repository secrets pelo usuário. Sem Environment/gate de aprovação, por falta de permissão do usuário para criá-lo (ver C1).

---

# PARTE B — Checklist de validação pós-migração

O que está em produção hoje via Lambda e precisa continuar funcionando depois da mudança. Estrutura de riscos idêntica à de dev (ver `lambda-to-ec2-migration.md` B2 para o racional completo), com os valores específicos de PROD abaixo.

## B1. Mapa do que existe hoje (produção)

| Recurso | Papel |
|---|---|
| `MedVirtualBackendNest-PROD` | Lambda — API HTTP produção |
| `nest-deal-worker-prod` | Lambda — Worker SQS produção |
| `cron-dispatcher` (`URL_BASE_PROD`) | Dispara as rotas de cron por HTTP contra o API Gateway de prod |
| API Gateway PROD | `https://1fpzjpnyg8.execute-api.us-east-1.amazonaws.com/prod` |
| Fila SQS | `deal-processing-queue-prod`, DLQ `deal-processing-dlq-prod` |

**Regras do EventBridge relevantes para PROD** (ver lista completa e agendamentos em `lambda-to-ec2-migration.md` B2.1 — os nomes `PROD_*` e `prod-*` daquela tabela já são os de produção, nada muda aqui).

## B2. Os três pontos de maior risco (aplicados a PROD)

### 1. As 19 rotas de cron
`URL_BASE_PROD` precisa ser atualizada para a nova URL **somente depois** que o checklist da Parte B estiver validado — nunca antes. Atenção redobrada aos crons de baixa frequência (`quarterlyPayoutRequests` roda a cada 3 meses) — um corte prematuro só mostra sintoma meses depois.

### 2. Webhooks externos (Bill.com, HubSpot)
Mesma lógica de dev: as URLs estão cadastradas do lado de fora (painel do Bill.com, app do HubSpot). Em produção, o custo de esquecer de atualizar é maior — dados reais de faturamento/CRM parando de sincronizar silenciosamente.

### 3. Worker SQS de produção
`nest-deal-worker-prod` consome `deal-processing-queue-prod` via event source mapping Lambda→SQS. Se um worker também subir nesta EC2 via PM2 fazendo polling, **as mensagens de produção serão processadas em duplicidade** — isso pode gerar efeitos colaterais reais (cobranças duplicadas, deals duplicados no HubSpot). Definir o corte antes de subir qualquer worker aqui: **nunca os dois ativos ao mesmo tempo**.

## B3. Checklist de validação

### Infraestrutura
- [ ] `pm2 list` mostra o app `online` (e o worker, se aplicável)
- [x] `pm2 startup` + `pm2 save` configurados — falta **testar reiniciando a instância** e confirmar que o app volta sozinho
- [ ] nginx faz proxy de 80/443 → `localhost:3000`
- [ ] HTTPS com certificado válido
- [x] IAM role associada à instância (`aws sts get-caller-identity` de dentro da EC2 — confirmado via IMDSv2 em 2026-08-21)

### Aplicação
- [ ] **Health check**: `GET /start` responde 200
- [ ] Swagger acessível em `/documentation`
- [ ] Login/autenticação funcionando (JWT — confirme que `JWT_SECRET` é o **mesmo** do Lambda-PROD, senão todos os tokens ativos de produção são invalidados)
- [x] Conexão com o RDS: `proddatabase` alcançável via TCP 5432 (confirmado em 2026-08-21) — falta validar `psql "$DATABASE_URL" -c 'SELECT 1;'` com credenciais reais após o `.env` ser copiado
- [ ] Timeout de 20 min preservado (`server.setTimeout` no `main.ts`) — nginx tem timeout **padrão de 60s**, ajustar

### Integrações externas
- [ ] **S3** — upload e download (avatar, documentos)
- [ ] **SQS** — mensagem publicada é consumida; confira que a DLQ prod **não** está acumulando
- [ ] **Textract** — processamento de currículo ponta a ponta
- [ ] **HubSpot** — sincronização e recebimento de webhook
- [ ] **OpenAI / OpenRouter** — geração funcionando
- [ ] **Resend** — envio de e-mail chegando de fato na caixa
- [ ] **Google Drive** — leitura/escrita
- [ ] **Bill.com** — webhook recebido e assinatura validada

### Cron
- [ ] `URL_BASE_PROD` do `cron-dispatcher` apontando para a nova URL
- [ ] Chamar manualmente algumas rotas `/cron/*` e conferir resposta 200
- [ ] Regras do EventBridge `PROD_*` / `prod-*` ainda `ENABLED`
- [ ] Verificar explicitamente os crons semanais/mensais/trimestrais na primeira ocorrência

### Webhooks
- [ ] URL atualizada no painel do **Bill.com**
- [ ] URL atualizada no app do **HubSpot**
- [ ] Evento de teste recebido e processado em cada um

### Corte final
- [ ] Event source mapping SQS→Lambda (`nest-deal-worker-prod`) desabilitado **ou** worker não iniciado na EC2 (nunca ambos)
- [ ] Lambdas antigas mantidas por um período como rollback, antes de remover
- [ ] Frontend apontando para a nova URL
- [ ] Monitorar logs (`pm2 logs`) nas primeiras horas — em produção, considerar uma janela de observação maior que em dev

## B4. Como validar rapidamente

```bash
# Health check (troque pela URL final)
curl -i https://<nova-url-prod>/start

# De dentro da instância
pm2 list
pm2 logs --lines 100
psql "$DATABASE_URL" -c 'SELECT 1;'
aws sts get-caller-identity          # confirma a IAM role

# DLQ acumulando = worker com problema
aws sqs get-queue-attributes --profile medvirtual --region us-east-1 \
  --queue-url https://sqs.us-east-1.amazonaws.com/920372998442/deal-processing-dlq-prod \
  --attribute-names ApproximateNumberOfMessages

# Lambda ainda recebendo tráfego? (deve zerar após o corte)
aws logs tail /aws/lambda/MedVirtualBackendNest-PROD --profile medvirtual --region us-east-1 --since 1h
```

## B5. Rollback

O Lambda e o API Gateway de produção continuam existindo até serem removidos. Se algo crítico falhar, o caminho de volta é reapontar as URLs (frontend, `cron-dispatcher`, webhooks) para o API Gateway e reabilitar o event source mapping do SQS.

**Não remova as Lambdas de produção** até o checklist estar completo, incluindo os crons de baixa frequência. Em produção, considere manter as Lambdas ativas por um período mais longo de observação do que em dev, dado o custo de um incidente real.

---

# PARTE C — Deploy automatizado via GitHub Actions (main)

Implementado em 2026-08-21. Adiciona deploy contínuo na EC2 a cada push na branch `main`, **sem remover o deploy Lambda existente** (`deploy.yml`, disparado em PR merged) — os dois workflows rodam em paralelo até a Parte B estar validada e o corte ser decidido.

## C1. Workflow

Arquivo: `.github/workflows/deploy-prod-ec2.yml`, modelado diretamente sobre `deploy-dev-ec2.yml` (dev) — mesma estrutura de job único, sem gate de aprovação manual.

> **Nota**: o desenho original deste pipeline previa um gate via GitHub Environments (`environment: production` + required reviewers). Isso foi revertido porque o usuário não tem permissão para criar Environments no repositório. A pipeline de prod segue então **exatamente o mesmo padrão de dev**: `push` em `main` dispara build + deploy direto, sem aprovação manual, usando secrets de repositório (não de Environment). Se o acesso para criar Environments for concedido no futuro, vale reavaliar a reintrodução do gate — ver C4.

**Secrets**: `PROD_SERVER_SSH_KEY`, `PROD_SERVER_HOST`, `PROD_SERVER_USER` — **secrets de repositório** (Settings → Secrets and variables → Actions → Repository secrets), dedicados a prod, não reaproveitados de dev/staging.

**Trigger**: só `push` em `main` — mesmo racional de dev (evita deploys concorrentes numa instância compartilhada).

**Fluxo do job** (único, `build-push-deploy`):
1. Checkout + `npm ci` + `prisma generate` + `npm run build` no runner do GitHub.
2. Empacota `dist/`, `package.json`, `package-lock.json`, `prisma/schema.prisma` e `prisma/migrations` em `release.tar.gz`.
3. Autentica via `webfactory/ssh-agent` com a chave do secret; `ssh-keyscan` confia no host antes de conectar.
4. Envia o tarball via `scp`.
5. Na instância: extrai o release, roda `npm ci --omit=dev`, `prisma generate`, `prisma migrate deploy`, e dá `pm2 reload` (ou `pm2 start` se o processo ainda não existir) + `pm2 save`.

## C2. Decisões e por que

| Decisão | Motivo |
|---|---|
| **Sem gate de aprovação manual** — job único, deploy direto no push | Decisão revertida em relação ao desenho inicial: o usuário não tem permissão para criar GitHub Environments neste repositório. Deploy de prod segue o mesmo padrão de dev por ora — risco aceito conscientemente, não uma omissão. |
| Keypair e secrets dedicados (`medvirtual-ec2-prod`, `PROD_*`), não reaproveitados de dev/staging | Isola o blast radius — comprometimento de credenciais de dev não dá acesso à instância de produção. Mantido mesmo sem o gate de Environment. |
| IAM role criada **antes** do provisionamento da EC2 | Evita repetir o bloqueio A5.1 do ambiente de dev (instância subiu sem instance profile, integrações S3/SQS/Textract ficaram bloqueadas até serem resolvidas depois). |
| `.env` **não é gerenciado pela pipeline** — fica fixo e persistido em `$DEPLOY_PATH/.env` na instância | Mesmo padrão de dev/staging — consistência de modelo de config entre os três ambientes (Lambda usa `.env` embarcado no zip; EC2-dev e EC2-prod usam `.env` fixo no servidor). |
| `node_modules` instalado **no servidor**, não enviado pelo runner | Dependências nativas (ex: `@napi-rs/canvas`) precisam de binário compatível com arm64/Graviton, que não bate com o runner Ubuntu x64 do GitHub. |
| `prisma migrate deploy` roda **no servidor**, não no runner | O RDS de produção só é alcançável de dentro da VPC — o runner do GitHub não tem esse acesso de rede. |
| `pm2 reload --update-env` em vez de `restart` | Reload é zero-downtime; `--update-env` garante que env vars alteradas manualmente no servidor sejam recarregadas sem derrubar o processo — ainda mais crítico em produção que em dev. |
| Deploy só em `push`, nunca em `pull_request` | Evita deploys concorrentes na mesma instância. |

## C3. Secrets do GitHub — passo a passo (a fazer manualmente)

Os secrets de produção **não existem ainda** e precisam ser criados como **secrets de repositório** (mesmo nível de acesso usado pelos secrets `STAGING_*` de dev), já que o usuário não tem permissão para criar GitHub Environments.

1. No repositório GitHub → **Settings → Secrets and variables → Actions → New repository secret**.
2. Criar três secrets:
   - `PROD_SERVER_SSH_KEY` — conteúdo do arquivo `~/.ssh/medvirtual-ec2-prod.pem` (chave privada da keypair `medvirtual-ec2-prod`)
   - `PROD_SERVER_HOST` — `32.192.106.103`
   - `PROD_SERVER_USER` — `ec2-user`
3. Salvar. A partir do próximo push em `main`, o workflow `deploy-prod-ec2.yml` já consegue rodar de ponta a ponta.

## C4. Pendências abertas para este pipeline

- [x] ~~Criar os três repository secrets `PROD_*`~~ — confirmado criado pelo usuário em 2026-08-21.
- [ ] Reavaliar a introdução de um gate de aprovação manual caso o usuário obtenha permissão para criar GitHub Environments no repositório — hoje o deploy de prod é tão automático quanto o de dev, sem revisão humana antes do `pm2 reload`.
- [x] ~~Copiar o `.env` de produção~~ — resolvido em 2026-08-21, ver A7.1. **Atenção**: rotação de segredo na Lambda não propaga automaticamente para cá — precisa ser replicada manualmente neste `.env` também.
- [ ] Configurar nginx como proxy reverso (80/443 → `localhost:3000`) e HTTPS antes de expor a instância a tráfego real. **Próximo bloqueio real para o primeiro deploy end-to-end** — sem isso a API só responde em `localhost:3000` dentro da própria instância, inacessível de fora.
- [ ] Definir se o worker SQS (`src/lambda-sqs.ts`, ver B2.3) também vai ser deployado por este pipeline em algum momento — hoje o workflow só cobre a API HTTP. A role já foi criada com permissões de `Receive`/`Delete`/`GetQueueAttributes` prevendo esse cenário, mas nada foi decidido.
- [ ] Depois que o deploy automatizado for validado, revisar o corte descrito em **B5** (Lambda prod vs EC2 prod) — este pipeline não faz esse corte sozinho, só adiciona a EC2 como mais um destino de deploy.
- [ ] Testar reboot da instância e confirmar que `pm2 resurrect` traz o app de volta sozinho (serviço `pm2-ec2-user.service` já habilitado, não testado com restart real).
