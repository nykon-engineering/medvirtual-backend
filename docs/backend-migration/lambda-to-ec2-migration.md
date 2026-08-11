# Migração Lambda → EC2: ambiente provisionado e checklist de validação

**Ambiente**: DEV · **Instância**: `i-063760d997e14f60a` · **IP**: `54.235.130.27`
**Situação**: infraestrutura pronta; deploy e migração sob responsabilidade da equipe de desenvolvimento.

Este documento tem duas partes:
- **Parte A** — o que já está provisionado (referência para a equipe)
- **Parte B** — checklist de validação pós-migração (para conferir que tudo voltou a funcionar)

---

# PARTE A — Ambiente provisionado

## A1. Recursos criados na AWS

| Recurso | ID / Valor |
|---|---|
| Perfil AWS local | `medvirtual` (conta `920372998442`, us-east-1) |
| Instância EC2 | `i-063760d997e14f60a` — t4g.small, arm64 (Graviton) |
| Elastic IP (fixo) | `54.235.130.27` |
| Key pair | `medvirtual-ec2` — `key-0cb30950ca4dca318` |
| Security group | `sg-050d000502f1c4b3a` (`SG-DEV-BACKEND-EC2`) |
| AMI | `ami-09317ccfac89b432d` (Amazon Linux 2023, kernel 6.1) |
| Regra de acesso ao RDS | `sgr-0b524626967b0ba32` (porta 5432, via source SG) |
| VPC / Subnet | `vpc-0a86b29ec09c1a424` / `subnet-0b102169f69c1f621` (pública) |

Disco: 30 GB gp3 criptografado (26 GB livres). IMDSv2 obrigatório.

## A2. Software instalado e verificado

| Software | Versão |
|---|---|
| Node.js | v22.23.2 |
| npm | 10.9.8 |
| PM2 | 7.0.3 |
| nginx | ativo (config padrão, sem proxy) |
| psql (client) | 15.18 |
| git | instalado |
| fail2ban | ativo |

**2 vCPU, 2 GB RAM + 2 GB de swap.**

> ⚠️ O swap é necessário: o build roda com `--max-old-space-size=4096` e não cabe só na RAM. `npm run build` falha por out-of-memory sem ele. **Não remover.**

> Node 22 (e não o 18 do `.nvmrc`): o `.nvmrc` reflete o runtime antigo do Lambda; o `Dockerfile` do projeto já usa `node:22-alpine`.

## A3. Rede

| Porta | Origem | Uso |
|---|---|---|
| 22 | `0.0.0.0/0` | SSH (só chave; senha e root desativados, fail2ban ativo) |
| 80 / 443 | `0.0.0.0/0` | HTTP/HTTPS público |
| 3000 | fechada | App — deve ser exposta via proxy reverso do nginx |

**Banco**: acesso ao RDS `devdatabase` já liberado por security group. Testado — PostgreSQL 17.9 respondendo.

## A4. Acesso

```bash
chmod 600 ~/.ssh/medvirtual-ec2      # obrigatório, senão o SSH recusa
ssh -i ~/.ssh/medvirtual-ec2 ec2-user@54.235.130.27
```

Fingerprint esperado do host: `SHA256:Ec0374bBTpxpT8ZsttVekztvLYwXAURr/tKnPp6AJqw`

## A5. Pendências antes do deploy

1. **IAM role da instância** — ⚠️ **bloqueante.** A aplicação usa S3, SQS e Textract; hoje essas permissões vêm da role do Lambda. A EC2 **não tem instance profile**, então essas integrações falham até que uma role seja criada e associada.
2. **`.env`** — não enviado à instância. Recomendado: AWS Secrets Manager.
3. **nginx como proxy reverso** para `localhost:3000` — não configurado.
4. **HTTPS** — sem certificado (Let's Encrypt ou ACM + ALB).
5. **`pm2 startup`** — para o app subir após reinício:
   ```bash
   pm2 startup systemd -u ec2-user --hp /home/ec2-user
   pm2 save
   ```

---

# PARTE B — Checklist de validação pós-migração

O que está em produção hoje via Lambda e precisa continuar funcionando depois da mudança.

## B1. Mapa do que existe hoje

**Lambdas ativas** (todas `nodejs20.x`, exceto onde indicado):

| Função | Papel |
|---|---|
| `MedVirtualBackendNest` | API HTTP — **DEV** |
| `MedVirtualBackendNest-PROD` | API HTTP — **PROD** |
| `nest-deal-worker-dev` | Worker SQS — DEV |
| `nest-deal-worker-prod` | Worker SQS — PROD |
| `cron-dispatcher` | Dispara as rotas de cron por HTTP |
| `medvirtual-backend-preview-invoicing` | `nodejs22.x` — preview de faturamento |

**URLs atuais (API Gateway)** — é o que muda na migração:

| Ambiente | URL |
|---|---|
| DEV | `https://gqwni79cgk.execute-api.us-east-1.amazonaws.com/dev` |
| PROD | `https://1fpzjpnyg8.execute-api.us-east-1.amazonaws.com/prod` |

**Filas SQS**: `deal-processing-queue-dev` / `-prod`, com DLQs `deal-processing-dlq-dev` / `-prod`.
Hoje ligadas aos workers por *event source mapping* (`Enabled`).

**Buckets S3**: `dev-bucket-for-lambda`, `prod-bucket-for-lambda`, `medvirtual-avatar`, `medvirtual-documents`, `public-medvirtual-files`, `textract-resume-test`.

## B2. Os três pontos de maior risco

### 1. As 19 rotas de cron

O `cron-dispatcher` chama o backend por HTTP usando as variáveis `URL_BASE_DEV` e `URL_BASE_PROD`, que hoje apontam para o **API Gateway**. Se o tráfego migrar para a EC2 e essas variáveis não forem atualizadas, **os crons continuam batendo no Lambda antigo** — ou falham silenciosamente.

São 19 rotas em `GET /cron/*`, entre elas:
`system-report`, `sync-clients-with-active-staffs`, `deactivate-client-users-no-staff`, `update-hubspot-deal-stages`, `sync-positions-from-hubspot`, `create-quarterly-payout-requests`, `sync-growth-partners-from-hubspot`, `sync-invoice-payment-dates`, `sync-invoice-due-dates`, `expire-stale-eligibility`, `daily-commission-summary`, `weekly-offer-panel-report`, `detect-commissions-by-affiliate`, `sync-hire-request-titles`, `reconcile-affiliate-contacts`, `sweep-stale-contact-ids`, `sync-organizations-with-hubspot`.

**Regras do EventBridge que disparam esses crons** (todas ENABLED, salvo indicação):

| Regra | Agendamento |
|---|---|
| `PROD-System_report` | `cron(36 16 * * ? *)` |
| `PROD_daily-commission-summary` | `cron(00 6 * * ? *)` |
| `PROD_promote-deployed-companies` | `cron(11 5 * * ? *)` |
| `PROD_reconcile-affiliate-contacts` | `cron(07 17 * * ? *)` |
| `prod-GetCandidateId` | `rate(8 hours)` |
| `prod-SyncAllOrganizationsWithDeals` | `rate(8 hours)` |
| `prod-deactivateClientUsersNoStaff` | `cron(0 5 ? * 1 *)` |
| `prod-failed` | `cron(45 2 * * ? *)` |
| `prod_Sync-business-units` | `cron(00 00 * * ? *)` |
| `prod_Sync-positions-from-hubspot` | `cron(0 5 ? * 2 *)` |
| `prod_Weekly-offerPanel-Report` | `cron(00 22 ? * 6 *)` |
| `prod_quarterlyPayoutRequests` | `cron(0 0 15 1/3 ? *)` |
| `DEV_reconcile-affiliate-contacts` | `cron(05 17 * * ? *)` |
| `Dev_Sync-positions-from-hubspot` | `cron(0 4 ? * 1 *)` |
| `dev-GetCandidateId` | `rate(8 hours)` |
| `dev-SyncAllOrganizationsWithDeals` | `rate(8 hours)` |
| `dev-deactivateClientUsersNoStaff` | `cron(0 3 ? * 1 *)` |
| `dev-failed` | `cron(30 2 * * ? *)` |
| `DEV_promote-deployed-companies` | **DISABLED** |

⚠️ Alguns rodam **semanal, mensal ou trimestralmente** (`quarterlyPayoutRequests` roda a cada 3 meses). Uma falha nesses **não aparece nos primeiros dias**. Não considere a migração validada só porque a primeira semana correu bem — cheque explicitamente os de baixa frequência.

### 2. Webhooks externos

Duas rotas recebem chamadas de sistemas de terceiros, com a URL cadastrada **do lado deles**:

| Webhook | Rota | Onde a URL está cadastrada |
|---|---|---|
| Bill.com | `POST /webhooks/bill-com` | Painel do Bill.com |
| HubSpot | `POST /hubspot/webhook` | App do HubSpot |

Mudar a URL do backend **sem atualizar esses cadastros** faz os eventos pararem de chegar. O sintoma é silencioso: nenhum erro no seu lado, os dados simplesmente param de atualizar. Ambos validam assinatura (`BILLCOM_WEBHOOK_SECRET`, `HUBSPOT_CLIENT_SECRET`) — confira que os segredos vão junto no `.env`.

### 3. Worker SQS

O consumo da fila hoje é via *event source mapping* Lambda → SQS, um mecanismo que **não existe em EC2**. Na EC2 o worker (`src/lambda-sqs.ts`) precisa virar um processo em execução contínua sob PM2, fazendo *polling* da fila.

Se as duas coisas ficarem ativas ao mesmo tempo, **as mensagens serão consumidas em duplicidade**. Defina o corte: ou desabilita o mapping do Lambda, ou não sobe o worker na EC2 — nunca os dois juntos.

## B3. Checklist de validação

### Infraestrutura
- [ ] `pm2 list` mostra o app `online` (e o worker, se aplicável)
- [ ] `pm2 startup` + `pm2 save` configurados — **teste reiniciando a instância** e confirme que o app volta sozinho
- [ ] nginx faz proxy de 80/443 → `localhost:3000`
- [ ] HTTPS com certificado válido
- [ ] IAM role associada à instância (`aws sts get-caller-identity` de dentro da EC2)

### Aplicação
- [ ] **Health check**: `GET /start` responde 200 (é o endpoint de saúde do projeto — não existe `/health`)
- [ ] Swagger acessível em `/documentation`
- [ ] Login/autenticação funcionando (JWT — confirme que `JWT_SECRET` é o **mesmo** do Lambda, senão todos os tokens ativos são invalidados e os usuários caem)
- [ ] Conexão com o RDS: `psql "$DATABASE_URL" -c 'SELECT 1;'`
- [ ] Timeout de 20 min preservado (`server.setTimeout` no `main.ts`) — o nginx tem timeout **padrão de 60s** e vai cortar requisições longas se não for ajustado

### Integrações externas
- [ ] **S3** — upload e download (avatar, documentos) — *depende da IAM role*
- [ ] **SQS** — mensagem publicada é consumida; confira que a DLQ **não** está acumulando
- [ ] **Textract** — processamento de currículo ponta a ponta — *depende da IAM role*
- [ ] **HubSpot** — sincronização e recebimento de webhook
- [ ] **OpenAI / OpenRouter** — geração funcionando
- [ ] **Resend** — envio de e-mail chegando de fato na caixa
- [ ] **Google Drive** — leitura/escrita
- [ ] **Bill.com** — webhook recebido e assinatura validada

### Cron
- [ ] `URL_BASE_DEV` / `URL_BASE_PROD` do `cron-dispatcher` apontando para a nova URL
- [ ] Chamar manualmente algumas rotas `/cron/*` e conferir resposta 200
- [ ] Regras do EventBridge ainda `ENABLED`
- [ ] Verificar explicitamente os crons semanais/mensais/trimestrais na primeira ocorrência

### Webhooks
- [ ] URL atualizada no painel do **Bill.com**
- [ ] URL atualizada no app do **HubSpot**
- [ ] Evento de teste recebido e processado em cada um

### Corte final
- [ ] Event source mapping SQS→Lambda desabilitado **ou** worker não iniciado na EC2 (nunca ambos)
- [ ] Lambdas antigas mantidas por um período como rollback, antes de remover
- [ ] Frontend apontando para a nova URL
- [ ] Monitorar logs (`pm2 logs`) nas primeiras horas

## B4. Como validar rapidamente

```bash
# Health check (troque pela URL final)
curl -i https://<nova-url>/start

# De dentro da instância
pm2 list
pm2 logs --lines 100
psql "$DATABASE_URL" -c 'SELECT 1;'
aws sts get-caller-identity          # confirma a IAM role

# DLQ acumulando = worker com problema
aws sqs get-queue-attributes --profile medvirtual --region us-east-1 \
  --queue-url https://sqs.us-east-1.amazonaws.com/920372998442/deal-processing-dlq-dev \
  --attribute-names ApproximateNumberOfMessages

# Lambda ainda recebendo tráfego? (deve zerar após o corte)
aws logs tail /aws/lambda/MedVirtualBackendNest --profile medvirtual --region us-east-1 --since 1h
```

> Dica de corte: enquanto as Lambdas existirem, `aws logs tail` mostra se algo ainda as chama. Invocação inesperada = algum cliente, cron ou webhook não foi apontado para a EC2.

## B5. Rollback

O Lambda e o API Gateway continuam existindo até serem removidos. Se algo crítico falhar, o caminho de volta é reapontar as URLs (frontend, `cron-dispatcher`, webhooks) para o API Gateway e reabilitar o event source mapping do SQS.

**Não remova as Lambdas** até o checklist estar completo, incluindo os crons de baixa frequência.
