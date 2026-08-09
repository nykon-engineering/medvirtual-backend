# Editable Emails — Technical Spec

> Closing deliverable for the ticket. Documents the architecture, models, endpoints, business rules, and test plan for the "Editable Emails" feature.

---

## 1. Overview

### Problem

All ~16 email templates in the system were hardcoded TypeScript functions in `/src/common/utils/email-templates/`. Any change to copy, branding, or layout required a developer and a full deploy — even for trivial changes like fixing a typo or updating a campaign name.

### Solution

Templates have been moved to the PostgreSQL database with an admin interface built into the app itself. An authorized user can now:

- Edit wording (subject, headline, body, button label) for any template
- Preview the HTML with sample data before saving
- Send a test email to themselves
- Browse and roll back to previous versions
- Manage branding per Business Unit (colors, logo, layout)
- Create and manage Business Units dynamically

Changes in any environment (Stage or Prod) are **automatically synced** to the opposite environment. The **fallback system** ensures that if a template is missing from the database, the original TypeScript code continues to be used — without any send failure.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Admin UI (Next.js 15)                     │
│  /modules/administration/email-templates  (list + editor)   │
│  /modules/administration/branding/[slug]  (branding per BU) │
│  /modules/administration/business-units   (BU management)   │
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
│         ├── getTemplateContent()  ← called by other svcs    │
│         ├── validatePlaceholders()                          │
│         ├── renderHtml()                                    │
│         └── syncToPeer()  ──► PEER_ENV_API_URL (fire & forget)
└─────────────────────────────────────────────────────────────┘
                         │ Auto-sync (X-Sync-Origin header)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│               Peer Environment API                          │
│  POST /email-templates/:key/sync    (no JWT, uses X-Sync-Secret)
│  POST /business-units/:slug/branding/sync                   │
│  → receiveSyncFromPeer() saves to DB and NEVER re-propagates│
└─────────────────────────────────────────────────────────────┘
```

### Services that read templates from the database

The following services replaced direct use of hardcoded files with the fallback pattern via `EmailTemplatesService.getTemplateContent()`:

| Service | Templates consumed |
|---|---|
| `AuthService` | `verification-code`, `invite-signup` |
| `RecoverypassService` | `reset-password` |
| `AffiliatesService` (med-alliance) | `med-alliance-invitation`, `med-alliance-invite-signup`, `med-alliance-org-invitation` |

The original TypeScript files in `/src/common/utils/email-templates/` remain as **permanent fallbacks** — they were never deleted.

---

## 3. Data Models (Prisma)

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

- `slug` is auto-generated from `name` in the frontend (`toSlug()`)
- When a BU is created, the backend automatically creates an `EmailBranding` with MedVirtual defaults
- Soft-delete via `is_active = false` (records are never physically deleted)

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
  business_unit String?                       // null = global; "medvirtual" = BU-specific override
  is_active     Boolean  @default(true)
  updated_by    String?
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt
  history       EmailTemplateHistory[]

  @@unique([key, business_unit])
}
```

- `business_unit: null` = global template (used by all BUs without a specific override)
- `@@unique([key, business_unit])` allows one override per key per BU
- `is_active: false` makes the system automatically fall back to code

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
  changed_by   String   // userId or "sync"
  changed_at   DateTime @default(now())
  reason       String?  // "Manual edit" | "Auto-sync from PROD" | "Rollback to version..."
}
```

- Snapshot created **before** each `update()` and `rollback()`
- `changed_by = "sync"` when the change came from automatic environment sync
- The last 50 records are displayed in the UI

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

- One record per BU (`@unique`)
- `layout_preset` accepts: `"default"`, `"minimal"`, `"hero"`
- When a BU is created, the backend sets `primary_color: "#01546B"` and `company_name` = BU name

### EmailBrandingHistory

```prisma
model EmailBrandingHistory {
  id          String   @id @default(uuid())
  branding_id String
  branding    EmailBranding @relation(...)
  snapshot    Json     // full previous state of EmailBranding
  changed_by  String
  changed_at  DateTime @default(now())
}
```

---

## 4. Endpoints

### Email Templates — `/email-templates`

| Method | Route | Auth | Body | Description |
|---|---|---|---|---|
| `GET` | `/email-templates` | `system_admin+` | — | Lists templates with pagination; `?page`, `?perPage`, `?search`, `?businessUnit` |
| `GET` | `/email-templates/:key` | `system_admin+` | — | Single template detail; `?businessUnit` |
| `PUT` | `/email-templates/:key` | `system_admin+` | `UpdateEmailTemplateDto` | Edits wording; validates placeholders; saves history; triggers sync |
| `GET` | `/email-templates/:key/history` | `system_admin+` | — | Last 50 versions of the template |
| `POST` | `/email-templates/:key/rollback/:historyId` | `system_admin+` | — | Restores a previous version; saves history; triggers sync |
| `POST` | `/email-templates/:key/preview` | `system_admin+` | `PreviewEmailTemplateDto` | Renders HTML with sample data for preview |
| `POST` | `/email-templates/:key/test-send` | `system_admin+` | `TestSendEmailTemplateDto` | Sends a real email to the logged-in user |
| `POST` | `/email-templates/:key/sync` | `X-Sync-Secret` header | `{ subject, headline?, body, button_label? }` | Receives sync from peer (no JWT) |

### Business Units — `/business-units`

| Method | Route | Auth | Body | Description |
|---|---|---|---|---|
| `GET` | `/business-units` | `system_super_admin` | — | Lists all BUs with branding |
| `POST` | `/business-units` | `system_super_admin` | `CreateBusinessUnitDto` | Creates BU + default branding |
| `PUT` | `/business-units/:slug` | `system_super_admin` | `UpdateBusinessUnitDto` | Edits name or status |
| `DELETE` | `/business-units/:slug` | `system_super_admin` | — | Soft-delete (`is_active = false`) |
| `GET` | `/business-units/:slug/branding` | `system_super_admin` | — | Current branding for the BU |
| `PUT` | `/business-units/:slug/branding` | `system_super_admin` | `UpdateBrandingDto` | Edits branding; saves history; triggers sync |
| `GET` | `/business-units/:slug/branding/history` | `system_super_admin` | — | Branding history |
| `POST` | `/business-units/:slug/branding/sync` | `X-Sync-Secret` header | branding payload | Receives branding sync from peer (no JWT) |

---

## 5. Bidirectional Sync Stage ↔ Prod

### Flow

```
[User edits template on Stage]
  ↓
Stage API: saves to Stage DB + creates history entry
  ↓ (fire-and-forget, does not block response)
Stage API → POST https://prod-api/email-templates/:key/sync
            headers: X-Sync-Secret, X-Sync-Origin: STAGE
  ↓
Prod API: validates X-Sync-Secret
Prod API: saves to Prod DB + creates history (changed_by: "sync", reason: "Auto-sync from STAGE")
Prod API: does NOT re-propagate (received X-Sync-Origin → it is a sync, not a UI edit)
```

### Anti-loop rule

`receiveSyncFromPeer()` **never** calls `syncToPeer()`. The distinction is made internally: UI saves go through `update()` which calls `syncToPeer()`. The `/sync` endpoint goes through `receiveSyncFromPeer()` which never propagates further.

### Failure behavior

- Sync is **fire-and-forget**: the local save always completes, even if the peer is unreachable
- Sync errors are logged via `Logger.error` but do not roll back the local save
- No automatic retry — manual reconciliation via a subsequent edit

### Required environment variables

| Variable | Stage server | Prod server |
|---|---|---|
| `PEER_ENV_API_URL` | `https://api.medvirtual.ai` (prod URL) | `https://staging.medvirtual.ai` (stage URL) |
| `INTER_ENV_SYNC_SECRET` | `<shared secret>` | `<same secret>` |
| `ENVIRONMENT` | `STAGE` | `PROD` |

If `PEER_ENV_API_URL` is not set, sync is silently skipped (correct behavior for local/dev environments).

---

## 6. Placeholder System

### Syntax

`{{placeholderName}}` — Mustache-style, unambiguous with Tailwind or JSX.

### Validation on save

Before persisting an update, `validatePlaceholders(body, allowedPlaceholders)` scans the body with `/\{\{[^}]+\}\}/g` and rejects any placeholder not declared in the template's `placeholders` list:

```
PUT /email-templates/invite-signup
body: "Click {{unknownPlaceholder}}"
→ 400 Bad Request: "Invalid placeholder(s): {{unknownPlaceholder}}. Allowed: {{inviteLink}}, {{companyName}}"
```

### Runtime substitution

`applyPlaceholders(text, overrides?)` first applies `SAMPLE_DATA` (for preview) and then the `overrides` passed by the calling service (for real sends). Placeholders without a runtime value remain as literal text — they never break the send.

### Sample data (for preview and test-send)

| Placeholder | Sample value |
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
| *(others)* | see `SAMPLE_DATA` in `email-templates.service.ts` |

---

## 7. Fallback System

Template resolution follows this priority chain:

```
1. EmailTemplate in DB (key + specific business_unit, is_active = true)
   ↓ not found
2. EmailTemplate in DB (key + business_unit = null [global], is_active = true)
   ↓ not found or is_active = false
3. getTemplateContent() returns null
   ↓ calling service uses the original TypeScript file as fallback
```

**Implementation in the calling service (standard pattern):**

```typescript
const dbContent = await this.emailTemplatesService.getTemplateContent(
  'invite-signup',
  { '{{inviteLink}}': link, '{{companyName}}': theme.companyName },
  theme,
);

const html = dbContent?.html ?? getInviteSignupTemplate(link, theme);
const subject = dbContent?.subject ?? `You have been invited to the ${theme.companyName} platform`;
```

The original TypeScript files in `/src/common/utils/email-templates/` **are never deleted** — they are the permanent safety net.

---

## 8. Dynamic Business Units

### Creation

```
POST /business-units
{ "name": "MMVA", "slug": "mmva" }
→ creates BusinessUnit { slug: "mmva", name: "MMVA", is_active: true }
→ creates EmailBranding { business_unit: "mmva", primary_color: "#01546B", company_name: "MMVA", layout_preset: "default" }
```

### Theme resolution for emails

`getUserEmailTheme(prisma, userId)` in `theme-helper.ts` queries the `EmailBranding` from the database for the user's BU. The mapping from BU name to slug is done by `orgBusinessUnitToSlug()`:

```typescript
"MedVirtual"    → "medvirtual"
"Berry Virtual" → "berry-virtual"
```

If no `EmailBranding` exists in the database for the BU, the system falls back to the hardcoded theme in `theme.ts`.

### Initial Business Units (seed)

| Slug | Name | Primary color |
|---|---|---|
| `medvirtual` | MedVirtual | `#01546B` |
| `berry-virtual` | Berry Virtual | `#FD7171` |

---

## 9. [DEV] Prefix

`MailService.sendMail()` prepends `[DEV]` to the `from` field when `process.env.ENVIRONMENT !== 'PROD'`:

```typescript
private applyDevPrefix(from: string): string {
  const isProduction = process.env.ENVIRONMENT === 'PROD';
  return isProduction ? from : `[DEV] ${from}`;
}
```

- **Centralized**: no other service needs to handle the prefix
- **Scope**: applied to the `from` field, which appears in the received email header
- **Test-send**: also goes through `MailService`, automatically receives the prefix in Stage

---

## 10. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `RESEND_API_KEY` | Yes | Resend API key for sending emails |
| `ENVIRONMENT` | Yes | `"PROD"` in production; any other value in Stage/Dev — controls the `[DEV]` prefix |
| `PEER_ENV_API_URL` | No | Base URL of the opposite environment for sync; omitting it in local/dev silently disables sync |
| `INTER_ENV_SYNC_SECRET` | Conditional | Shared secret between Stage and Prod to authenticate sync requests; required if `PEER_ENV_API_URL` is set |
| `DATABASE_URL` | Yes | PostgreSQL URL (via Prisma) |

---

## 11. File Structure

### Backend

```
src/
├── email-templates/
│   ├── email-templates.controller.ts   # 9 endpoints
│   ├── email-templates.module.ts
│   ├── email-templates.service.ts      # core logic
│   ├── email-templates.service.spec.ts # 30 unit tests
│   ├── email-templates-e2e.spec.ts     # 41 E2E integration tests
│   └── dto/
│       ├── update-email-template.dto.ts
│       ├── preview-email-template.dto.ts
│       └── test-send-email-template.dto.ts
├── business-units/
│   ├── business-units.controller.ts    # 8 endpoints
│   ├── business-units.module.ts
│   ├── business-units.service.ts       # CRUD + branding + sync
│   ├── business-units.service.spec.ts  # 20 unit tests
│   └── dto/
│       ├── create-business-unit.dto.ts
│       ├── update-business-unit.dto.ts
│       └── update-branding.dto.ts
├── mail/
│   ├── mail.service.ts                 # [DEV] prefix centralized here
│   └── mail.service.spec.ts            # 4 [DEV] prefix tests
└── common/utils/email-templates/       # permanent fallback (do not delete)
    ├── theme.ts
    ├── theme-helper.ts                 # updated to read EmailBranding from DB
    └── *.ts                            # 16 template files (fallback)

prisma/
├── schema.prisma                       # +5 models: BusinessUnit, EmailTemplate,
│                                       #  EmailTemplateHistory, EmailBranding, EmailBrandingHistory
└── seed.ts                             # +2 BUs, +2 Brandings, +16 templates
```

### Frontend

```
src/app/modules/administration/
├── email-templates/
│   ├── page.tsx                        # list with DataTable + BU filter + STAGE/PROD badge
│   ├── [key]/
│   │   ├── page.tsx                    # minimal wrapper (resolves use(params))
│   │   └── _components/
│   │       └── editor-view.tsx         # split-screen editor: form + preview + history
│   └── _tests/
│       ├── page.test.tsx               # 8 tests
│       └── editor.test.tsx             # 10 tests
├── branding/
│   └── [slug]/
│       └── page.tsx                    # color picker + logo + layout preset + history
├── business-units/
│   ├── page.tsx                        # cards + create/edit/deactivate dialogs
│   └── _tests/
│       └── page.test.tsx               # 12 tests
└── _lib/
    └── admin-nav.ts                    # nav items: Email Templates + Business Units
```

---

## 12. Test Coverage

| File | Type | Tests | What it covers |
|---|---|---|---|
| `email-templates.service.spec.ts` | Unit | 30 | CRUD, fallback, placeholder validation, preview, test-send, rollback, sync anti-loop |
| `email-templates-e2e.spec.ts` | E2E Integration | 41 | 16 seed templates, fallback, anti-loop, [DEV] prefix, history, per-BU branding |
| `business-units.service.spec.ts` | Unit | 20 | BU CRUD, auto-create branding, bidirectional sync, branding rollback |
| `mail.service.spec.ts` | Unit | 4 | [DEV] prefix in STAGE, DEV, undefined, and absence in PROD |
| `email-templates/_tests/page.test.tsx` | Frontend | 8 | Template list, filter, navigation to editor |
| `email-templates/_tests/editor.test.tsx` | Frontend | 10 | Editor: form, chips, history, rollback dialog, test-send, navigation |
| `business-units/_tests/page.test.tsx` | Frontend | 12 | Cards, dialogs, auto-slug, search, filter, deactivate |
| **Total** | | **125** | |

---

## 13. Manual Verification Checklist (QA)

### Fallback
- [ ] Delete a template from the database → trigger the corresponding event → confirm the email is still sent with the original TypeScript content

### Wording
- [ ] Change the subject of `invite-signup` → send an invitation → confirm the new subject in the received email

### Invalid placeholder
- [ ] Try to save a body with `{{undeclaredPlaceholder}}` → confirm that the save is blocked with an error message listing the invalid placeholder

### Test Send
- [ ] Click "Send Test" in the editor → confirm the email arrived in the inbox with sample data and with the `[DEV]` prefix (on Stage)

### Rollback
- [ ] Edit a template, confirm a history entry was created, perform a rollback → confirm the content reverted to the previous state

### Branding
- [ ] Change the `primary_color` of a BU in the editor → see the preview update → save → send a real email → confirm the color was applied

### Dynamic Business Unit
- [ ] Create a new BU via the admin screen → confirm it appears as an option in the template filter → confirm the default `EmailBranding` was automatically created

### Sync Stage → Prod
- [ ] Edit a template on Stage → wait 2s → confirm on Prod that the template was updated and the history records `changed_by: "sync"` with `reason: "Auto-sync from STAGE"`

### [DEV] Prefix
- [ ] Trigger any email on Stage → confirm that the `from` field in the received email starts with `[DEV]`
- [ ] On Prod: confirm that the `from` field does NOT have the `[DEV]` prefix

### Sync endpoint security
- [ ] `POST /email-templates/:key/sync` without the `X-Sync-Secret` header → confirm `401 Unauthorized`
- [ ] With wrong secret → confirm `401 Unauthorized`

---

## 14. Alternative Solutions Considered and Discarded

### A. React Email (component-based templates)
Would shift the template stack from TypeScript strings to React components — a significant migration of the 16 existing templates. Recommended for a future iteration if the volume grows substantially.

### B. Unlayer / BeeFree (WYSIWYG editor)
Embeddable drag-and-drop editor SDKs. High integration cost and external dependency. Only appropriate if the requirement evolves to "anyone edits the design freely without layout restrictions."

### C. Native Resend templates
Resend has a template management feature. Loses in-app history/rollback control and requires Resend dashboard access for editors. Incompatible with the requirement for an internal screen.

### D. Headless CMS (Contentful / Sanity)
Adds an expensive external dependency for a small volume of templates. Only justifiable with 100+ templates and multiple languages.

---

## 15. Development Timeline

| Week | Scope | Status |
|---|---|---|
| Week 1 | Prisma models, seed, migration, EmailTemplatesService, BusinessUnitsService, bidirectional sync, fallback in AuthService/RecoverypassService/AffiliatesService, updated theme-helper | ✅ Done |
| Week 2 | List page, split-screen editor, branding page, business-units page, frontend tests | ✅ Done |
| Week 3 | E2E tests, technical spec, Remotion video, final QA | 🔄 In progress |
