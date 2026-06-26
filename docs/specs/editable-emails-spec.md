# Editable Emails — Spec Técnica

> Entregável de fechamento de ticket. Documenta arquitetura, modelos, endpoints, regras de negócio e plano de testes da feature "Editable Emails".

---

## 1. Visão Geral

### Problema

Todos os ~16 templates de email do sistema eram funções TypeScript hardcoded em `/src/common/utils/email-templates/`. Qualquer alteração de texto, branding ou layout exigia um desenvolvedor e um deploy completo — mesmo para mudanças triviais como corrigir um typo ou atualizar o nome de uma campanha.

### Solução

Os templates foram movidos para o banco de dados PostgreSQL com uma interface de administração dentro do próprio app. Um usuário autorizado pode agora:

- Editar wording (subject, headline, body, button label) de qualquer template
- Visualizar preview em HTML com dados de exemplo antes de salvar
- Enviar um email de teste para si mesmo
- Consultar e reverter para versões anteriores (rollback)
- Gerenciar brandings por Business Unit (cores, logo, layout)
- Criar e gerenciar Business Units dinamicamente

Mudanças em qualquer ambiente (Stage ou Prod) são **sincronizadas automaticamente** para o ambiente oposto. O sistema de **fallback** garante que, se um template estiver ausente do banco, o código original TypeScript continua sendo usado — sem falha de envio.

---

## 2. Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    Admin UI (Next.js 15)                     │
│  /modules/administration/email-templates  (lista + editor)  │
│  /modules/administration/branding/[slug]  (branding por BU) │
│  /modules/administration/business-units   (gestão de BUs)   │
└────────────────────────┬────────────────────────────────────┘
                         │ JWT Bearer
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   NestJS API (Backend)                       │
│                                                             │
│  EmailTemplatesController  /email-templates                 │
│  BusinessUnitsController   /business-units                  │
│                                                             │
│  EmailTemplatesService ──► PrismaService ──► PostgreSQL DB  │
│         │                                                   │
│         ├── getTemplateContent()  ← chamado por outros svc  │
│         ├── validatePlaceholders()                          │
│         ├── renderHtml()                                    │
│         └── syncToPeer()  ──► PEER_ENV_API_URL (fire & forget)
└─────────────────────────────────────────────────────────────┘
                         │ Auto-sync (X-Sync-Origin header)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│               Peer Environment API                          │
│  POST /email-templates/:key/sync    (sem JWT, usa X-Sync-Secret)
│  POST /business-units/:slug/branding/sync                   │
│  → receiveSyncFromPeer() salva no DB e NUNCA re-propaga     │
└─────────────────────────────────────────────────────────────┘
```

### Serviços que lêem templates do banco

Os seguintes serviços substituíram o uso direto dos arquivos hardcoded pelo padrão de fallback via `EmailTemplatesService.getTemplateContent()`:

| Serviço | Templates consumidos |
|---|---|
| `AuthService` | `verification-code`, `invite-signup` |
| `RecoverypassService` | `reset-password` |
| `AffiliatesService` (med-alliance) | `med-alliance-invitation`, `med-alliance-invite-signup`, `med-alliance-org-invitation` |

Os arquivos TypeScript originais em `/src/common/utils/email-templates/` permanecem como **fallback permanente** — nunca foram deletados.

---

## 3. Modelos de Dados (Prisma)

### BusinessUnit

```prisma
model BusinessUnit {
  id         String   @id @default(uuid())
  slug       String   @unique          // "medvirtual", "berry-virtual", "mmva"
  name       String                    // "MedVirtual", "Berry Virtual"
  is_active  Boolean  @default(true)
  created_at DateTime @default(now())
  created_by String?
  branding   EmailBranding?
  templates  EmailTemplate[]
}
```

- `slug` é gerado automaticamente a partir do `name` no frontend (`toSlug()`)
- Ao criar uma BU, o backend cria automaticamente um `EmailBranding` com defaults do MedVirtual
- Soft-delete via `is_active = false` (não deleta registros)

### EmailTemplate

```prisma
model EmailTemplate {
  id            String   @id @default(uuid())
  key           String                        // "invite-signup"
  name          String                        // "User Invitation"
  description   String?
  subject       String
  headline      String?
  body          String
  button_label  String?
  button_url    String?
  placeholders  Json                          // ["{{inviteLink}}", "{{companyName}}"]
  business_unit String?                       // null = global; "medvirtual" = override por BU
  is_active     Boolean  @default(true)
  updated_by    String?
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt
  history       EmailTemplateHistory[]

  @@unique([key, business_unit])
}
```

- `business_unit: null` = template global (usado por todas as BUs sem override específico)
- `@@unique([key, business_unit])` permite um override por chave por BU
- `is_active: false` faz o sistema cair no fallback de código automaticamente

### EmailTemplateHistory

```prisma
model EmailTemplateHistory {
  id           String   @id @default(uuid())
  template_id  String
  template     EmailTemplate @relation(...)
  subject      String
  headline     String?
  body         String
  button_label String?
  changed_by   String   // userId ou "sync"
  changed_at   DateTime @default(now())
  reason       String?  // "Manual edit" | "Auto-sync from PROD" | "Rollback to version..."
}
```

- Snapshot criado **antes** de cada `update()` e `rollback()`
- `changed_by = "sync"` quando a mudança veio de sincronização automática entre ambientes
- Os últimos 50 registros são exibidos na UI

### EmailBranding

```prisma
model EmailBranding {
  id              String   @id @default(uuid())
  business_unit   String   @unique
  primary_color   String
  secondary_color String?
  logo_url        String?
  company_name    String
  layout_preset   String   @default("default")
  updated_by      String?
  updated_at      DateTime @updatedAt
  history         EmailBrandingHistory[]
}
```

- Um registro por BU (`@unique`)
- `layout_preset` aceita: `"default"`, `"minimal"`, `"hero"`
- Ao criar uma BU, o backend preenche com `primary_color: "#01546B"` e `company_name` = nome da BU

### EmailBrandingHistory

```prisma
model EmailBrandingHistory {
  id          String   @id @default(uuid())
  branding_id String
  branding    EmailBranding @relation(...)
  snapshot    Json     // estado completo anterior do EmailBranding
  changed_by  String
  changed_at  DateTime @default(now())
}
```

---

## 4. Endpoints

### Email Templates — `/email-templates`

| Método | Rota | Auth | Body | Descrição |
|---|---|---|---|---|
| `GET` | `/email-templates` | `system_admin+` | — | Lista templates com paginação; `?page`, `?perPage`, `?search`, `?businessUnit` |
| `GET` | `/email-templates/:key` | `system_admin+` | — | Detalhe de um template; `?businessUnit` |
| `PUT` | `/email-templates/:key` | `system_admin+` | `UpdateEmailTemplateDto` | Edita wording; valida placeholders; salva histórico; dispara sync |
| `GET` | `/email-templates/:key/history` | `system_admin+` | — | Últimas 50 versões do template |
| `POST` | `/email-templates/:key/rollback/:historyId` | `system_admin+` | — | Restaura versão anterior; salva histórico; dispara sync |
| `POST` | `/email-templates/:key/preview` | `system_admin+` | `PreviewEmailTemplateDto` | Renderiza HTML com sample data para preview |
| `POST` | `/email-templates/:key/test-send` | `system_admin+` | `TestSendEmailTemplateDto` | Envia email real para o usuário logado |
| `POST` | `/email-templates/:key/sync` | `X-Sync-Secret` header | `{ subject, headline?, body, button_label? }` | Recebe sync do peer (sem JWT) |

### Business Units — `/business-units`

| Método | Rota | Auth | Body | Descrição |
|---|---|---|---|---|
| `GET` | `/business-units` | `system_super_admin` | — | Lista todas as BUs com branding |
| `POST` | `/business-units` | `system_super_admin` | `CreateBusinessUnitDto` | Cria BU + branding default |
| `PUT` | `/business-units/:slug` | `system_super_admin` | `UpdateBusinessUnitDto` | Edita nome ou status |
| `DELETE` | `/business-units/:slug` | `system_super_admin` | — | Soft-delete (`is_active = false`) |
| `GET` | `/business-units/:slug/branding` | `system_super_admin` | — | Branding atual da BU |
| `PUT` | `/business-units/:slug/branding` | `system_super_admin` | `UpdateBrandingDto` | Edita branding; salva histórico; dispara sync |
| `GET` | `/business-units/:slug/branding/history` | `system_super_admin` | — | Histórico de branding |
| `POST` | `/business-units/:slug/branding/sync` | `X-Sync-Secret` header | payload de branding | Recebe sync de branding do peer (sem JWT) |

---

## 5. Sync Bidirecional Stage ↔ Prod

### Fluxo

```
[Usuário edita template no Stage]
  ↓
Stage API: salva no Stage DB + cria histórico
  ↓ (fire-and-forget, não bloqueia resposta)
Stage API → POST https://prod-api/email-templates/:key/sync
            headers: X-Sync-Secret, X-Sync-Origin: STAGE
  ↓
Prod API: valida X-Sync-Secret
Prod API: salva no Prod DB + cria histórico (changed_by: "sync", reason: "Auto-sync from STAGE")
Prod API: NÃO re-propaga (recebeu X-Sync-Origin → é uma sync, não uma edição UI)
```

### Regra anti-loop

`receiveSyncFromPeer()` **nunca** chama `syncToPeer()`. A distinção é feita internamente: saves da UI passam por `update()` que chama `syncToPeer()`. O endpoint `/sync` passa por `receiveSyncFromPeer()` que nunca propaga.

### Comportamento em falha

- A sincronização é **fire-and-forget**: o save local sempre completa, mesmo que o peer esteja fora do ar
- Erros de sync são logados via `Logger.error` mas não revertem o save local
- Não há retry automático — reconciliação manual via edição posterior

### Variáveis de ambiente necessárias

| Variável | Servidor Stage | Servidor Prod |
|---|---|---|
| `PEER_ENV_API_URL` | `https://api.medvirtual.ai` (URL do prod) | `https://staging.medvirtual.ai` (URL do stage) |
| `INTER_ENV_SYNC_SECRET` | `<segredo compartilhado>` | `<mesmo segredo>` |
| `ENVIRONMENT` | `STAGE` | `PROD` |

Se `PEER_ENV_API_URL` não estiver definida, o sync é silenciosamente omitido (comportamento correto para ambiente local/dev).

---

## 6. Sistema de Placeholders

### Sintaxe

`{{placeholderName}}` — estilo Mustache, sem ambiguidade com Tailwind ou JSX.

### Validação no save

Antes de persistir um update, `validatePlaceholders(body, allowedPlaceholders)` escaneia o body com `/\{\{[^}]+\}\}/g` e rejeita qualquer placeholder não declarado na lista `placeholders` do template:

```
PUT /email-templates/invite-signup
body: "Click {{unknownPlaceholder}}"
→ 400 Bad Request: "Invalid placeholder(s): {{unknownPlaceholder}}. Allowed: {{inviteLink}}, {{companyName}}"
```

### Substituição em runtime

`applyPlaceholders(text, overrides?)` aplica primeiro o `SAMPLE_DATA` (para preview) e depois os `overrides` passados pelo serviço chamador (para envio real). Placeholders sem valor de runtime permanecem como texto literal — nunca quebram o envio.

### Sample data (para preview e test-send)

| Placeholder | Valor de exemplo |
|---|---|
| `{{inviteLink}}` | `https://app.medvirtual.ai/invite/sample-token` |
| `{{resetLink}}` | `https://app.medvirtual.ai/reset/sample-token` |
| `{{verificationCode}}` | `482951` |
| `{{userName}}` | `Jane Smith` |
| `{{companyName}}` | `MedVirtual` |
| `{{organizationName}}` | `Bright Dental Clinic` |
| `{{positionCount}}` | `3` |
| `{{quarter}}` / `{{year}}` | `Q1` / `2026` |
| `{{totalEarnings}}` | `$1,250.00` |
| *(demais)* | ver `SAMPLE_DATA` em `email-templates.service.ts` |

---

## 7. Sistema de Fallback

A resolução de template segue esta cadeia de prioridade:

```
1. EmailTemplate no DB (key + business_unit específica, is_active = true)
   ↓ não encontrado
2. EmailTemplate no DB (key + business_unit = null [global], is_active = true)
   ↓ não encontrado ou is_active = false
3. getTemplateContent() retorna null
   ↓ serviço chamador usa o arquivo TypeScript original como fallback
```

**Implementação no serviço chamador (padrão):**

```typescript
const dbContent = await this.emailTemplatesService.getTemplateContent(
  'invite-signup',
  { '{{inviteLink}}': link, '{{companyName}}': theme.companyName },
  theme,
);

const html = dbContent?.html ?? getInviteSignupTemplate(link, theme);
const subject = dbContent?.subject ?? `You have been invited to the ${theme.companyName} platform`;
```

Os arquivos TypeScript originais em `/src/common/utils/email-templates/` **nunca são deletados** — são a rede de segurança permanente.

---

## 8. Business Units Dinâmicas

### Criação

```
POST /business-units
{ "name": "MMVA", "slug": "mmva" }
→ cria BusinessUnit { slug: "mmva", name: "MMVA", is_active: true }
→ cria EmailBranding { business_unit: "mmva", primary_color: "#01546B", company_name: "MMVA", layout_preset: "default" }
```

### Resolução de tema em emails

`getUserEmailTheme(prisma, userId)` em `theme-helper.ts` consulta o `EmailBranding` do banco para a BU do usuário. O mapeamento de nome de BU para slug é feito por `orgBusinessUnitToSlug()`:

```typescript
"MedVirtual"    → "medvirtual"
"Berry Virtual" → "berry-virtual"
```

Se não houver `EmailBranding` no banco para a BU, o sistema cai no tema hardcoded em `theme.ts` como fallback.

### Business Units iniciais (seed)

| Slug | Nome | Cor primária |
|---|---|---|
| `medvirtual` | MedVirtual | `#01546B` |
| `berry-virtual` | Berry Virtual | `#FD7171` |

---

## 9. Prefixo [DEV]

`MailService.sendMail()` aplica `[DEV]` ao campo `from` quando `process.env.ENVIRONMENT !== 'PROD'`:

```typescript
private applyDevPrefix(from: string): string {
  const isProduction = process.env.ENVIRONMENT === 'PROD';
  return isProduction ? from : `[DEV] ${from}`;
}
```

- **Centralizado**: nenhum outro serviço precisa se preocupar com o prefixo
- **Escopo**: aplicado ao campo `from`, que aparece no cabeçalho do email recebido
- **Test-send**: também passa pelo `MailService`, recebe o prefixo automaticamente em Stage

---

## 10. Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `RESEND_API_KEY` | Sim | Chave da API Resend para envio de emails |
| `ENVIRONMENT` | Sim | `"PROD"` em produção; qualquer outro valor em Stage/Dev — controla o prefixo `[DEV]` |
| `PEER_ENV_API_URL` | Não | URL base do ambiente oposto para sync; omitir em local/dev desativa o sync silenciosamente |
| `INTER_ENV_SYNC_SECRET` | Condicional | Segredo compartilhado entre Stage e Prod para autenticar requests de sync; obrigatório se `PEER_ENV_API_URL` estiver definida |
| `DATABASE_URL` | Sim | URL do PostgreSQL (via Prisma) |

---

## 11. Estrutura de Arquivos

### Backend

```
src/
├── email-templates/
│   ├── email-templates.controller.ts   # 9 endpoints
│   ├── email-templates.module.ts
│   ├── email-templates.service.ts      # lógica central
│   ├── email-templates.service.spec.ts # 30 testes unitários
│   ├── email-templates-e2e.spec.ts     # 41 testes de integração E2E
│   └── dto/
│       ├── update-email-template.dto.ts
│       ├── preview-email-template.dto.ts
│       └── test-send-email-template.dto.ts
├── business-units/
│   ├── business-units.controller.ts    # 8 endpoints
│   ├── business-units.module.ts
│   ├── business-units.service.ts       # CRUD + branding + sync
│   ├── business-units.service.spec.ts  # 20 testes unitários
│   └── dto/
│       ├── create-business-unit.dto.ts
│       ├── update-business-unit.dto.ts
│       └── update-branding.dto.ts
├── mail/
│   ├── mail.service.ts                 # prefixo [DEV] centralizado aqui
│   └── mail.service.spec.ts            # 4 testes de prefixo [DEV]
└── common/utils/email-templates/       # fallback permanente (não deletar)
    ├── theme.ts
    ├── theme-helper.ts                 # atualizado para ler EmailBranding do banco
    └── *.ts                            # 16 arquivos de template (fallback)

prisma/
├── schema.prisma                       # +5 modelos: BusinessUnit, EmailTemplate,
│                                       #  EmailTemplateHistory, EmailBranding, EmailBrandingHistory
└── seed.ts                             # +2 BUs, +2 Brandings, +16 templates
```

### Frontend

```
src/app/modules/administration/
├── email-templates/
│   ├── page.tsx                        # lista com DataTable + filtro BU + badge STAGE/PROD
│   ├── [key]/
│   │   ├── page.tsx                    # wrapper mínimo (resolve use(params))
│   │   └── _components/
│   │       └── editor-view.tsx         # editor split-screen: form + preview + history
│   └── _tests/
│       ├── page.test.tsx               # 8 testes
│       └── editor.test.tsx             # 10 testes
├── branding/
│   └── [slug]/
│       └── page.tsx                    # color picker + logo + layout preset + history
├── business-units/
│   ├── page.tsx                        # cards + create/edit/deactivate dialogs
│   └── _tests/
│       └── page.test.tsx               # 12 testes
└── _lib/
    └── admin-nav.ts                    # itens de nav: Email Templates + Business Units
```

---

## 12. Cobertura de Testes

| Arquivo | Tipo | Testes | O que cobre |
|---|---|---|---|
| `email-templates.service.spec.ts` | Unitário | 30 | CRUD, fallback, placeholder validation, preview, test-send, rollback, sync anti-loop |
| `email-templates-e2e.spec.ts` | Integração E2E | 41 | 16 templates do seed, fallback, anti-loop, [DEV] prefix, history, branding per-BU |
| `business-units.service.spec.ts` | Unitário | 20 | CRUD de BU, branding auto-create, sync bidirecional, rollback de branding |
| `mail.service.spec.ts` | Unitário | 4 | Prefixo [DEV] em STAGE, DEV, undefined, e ausência em PROD |
| `email-templates/_tests/page.test.tsx` | Frontend | 8 | Lista de templates, filtro, navegação para editor |
| `email-templates/_tests/editor.test.tsx` | Frontend | 10 | Editor: form, chips, history, rollback dialog, test-send, navegação |
| `business-units/_tests/page.test.tsx` | Frontend | 12 | Cards, dialogs, auto-slug, search, filtro, deactivate |
| **Total** | | **125** | |

---

## 13. Checklist de Verificação Manual (QA)

### Fallback
- [ ] Deletar um template do banco → enviar o evento correspondente → confirmar que o email ainda é enviado com o conteúdo original do código TypeScript

### Wording
- [ ] Alterar o subject de `invite-signup` → enviar um convite → confirmar novo subject no email recebido

### Placeholder inválido
- [ ] Tentar salvar body com `{{placeholderNaoDeclarado}}` → confirmar que o save é bloqueado com mensagem de erro listando o placeholder inválido

### Test Send
- [ ] Clicar "Send Test" no editor → confirmar que o email chegou no inbox com sample data e com prefixo `[DEV]` (em Stage)

### Rollback
- [ ] Editar um template, confirmar que histórico foi criado, fazer rollback → confirmar que conteúdo voltou ao estado anterior

### Branding
- [ ] Trocar a `primary_color` de uma BU no editor → ver preview atualizar → salvar → enviar email real → confirmar cor aplicada

### Business Unit dinâmica
- [ ] Criar nova BU via tela de admin → confirmar que aparece como opção no filtro de templates → confirmar que `EmailBranding` padrão foi criado automaticamente

### Sync Stage → Prod
- [ ] Editar template no Stage → aguardar 2s → confirmar no Prod que template foi atualizado e histórico registra `changed_by: "sync"` com `reason: "Auto-sync from STAGE"`

### Prefixo [DEV]
- [ ] Disparar qualquer email no Stage → confirmar que o campo `from` no email recebido começa com `[DEV]`
- [ ] Em Prod: confirmar que o campo `from` NÃO tem prefixo `[DEV]`

### Segurança do endpoint de sync
- [ ] `POST /email-templates/:key/sync` sem header `X-Sync-Secret` → confirmar `401 Unauthorized`
- [ ] Com secret errado → confirmar `401 Unauthorized`

---

## 14. Soluções Alternativas Consideradas e Descartadas

### A. React Email (component-based templates)
Mudaria a stack de templates de strings TypeScript para componentes React — migração significativa dos 16 templates existentes. Recomendada para iteração futura se o volume crescer muito.

### B. Unlayer / BeeFree (editor WYSIWYG)
SDKs embedáveis de editor drag-and-drop. Alto custo de integração e dependência externa. Adequado apenas se o requisito evoluir para "qualquer pessoa edita o design livremente sem restrições de layout".

### C. Templates nativos do Resend
Resend tem feature de template management. Perde controle de histórico/rollback dentro do app e requer acesso ao painel Resend para quem edita. Incompatível com o requisito de tela interna.

### D. CMS Headless (Contentful / Sanity)
Adiciona dependência externa cara para um volume pequeno de templates. Justificável apenas com 100+ templates e múltiplos idiomas.

---

## 15. Cronograma de Desenvolvimento

| Semana | Escopo | Status |
|---|---|---|
| Semana 1 | Modelos Prisma, seed, migration, EmailTemplatesService, BusinessUnitsService, sync bidirecional, fallback em AuthService/RecoverypassService/AffiliatesService, theme-helper atualizado | ✅ Concluído |
| Semana 2 | Página lista, editor split-screen, página branding, página business-units, testes de frontend | ✅ Concluído |
| Semana 3 | Testes E2E, spec técnica, vídeo Remotion, QA final | 🔄 Em andamento |
