# Hubspot Audit Log — Spec

## Overview

Every outbound call we make to Hubspot and every inbound webhook event we receive from Hubspot is persisted as an immutable row in `HubspotAuditLog`. The table provides a full audit trail for traceability, debugging, and compliance: who triggered what change, when, against which entity, and whether it succeeded.

**Key design decisions:**

- **Append-only** — rows are never updated or deleted.
- **Fire-and-forget for success paths** — audit writes use `void this.audit.log(...)` so a DB failure never propagates into business logic.
- **Error paths always await** — when a Hubspot call fails, the `catch` block writes the failure log synchronously before re-throwing.
- **No new dependencies** — actor identity is threaded explicitly via `actorUserId?: string` parameter (consistent with existing patterns in this codebase) instead of a CLS/async-context store.

---

## Database Model

**Table:** `HubspotAuditLog`  
**Migration:** `20260506170635_add_hubspot_audit_log`

| Column | Type | Description |
|---|---|---|
| `id` | `String` (UUID) | Primary key |
| `actor_user_id` | `String?` | FK → `USER.id`. Set for human-triggered actions. `null` for webhooks, cron, and bulk sync. |
| `actor_label` | `String?` | `'WebhookHubspot'` \| `'CronJob'` \| `'BulkSync'` \| `null` (human actors use `null` here). |
| `entity_type` | `HubspotEntityType` | Enum — see below. |
| `entity_id` | `String` | DB UUID of the affected entity. For inbound webhook events where no DB UUID is available, stores the Hubspot `objectId`. |
| `hubspot_object_id` | `String?` | Hubspot-side object ID. `null` if the call failed before a response was received. |
| `hubspot_object_type` | `String` | Hubspot API object type: `tickets`, `companies`, `contacts`, `deals`, `owners`, `p20630393_growth_partners`, `0-53`, or the VA custom object env var. |
| `action` | `HubspotAuditAction` | Enum — see below. |
| `source` | `HubspotAuditSource` | Enum — see below. |
| `success` | `Boolean` | `true` if the Hubspot API call completed without error. |
| `payload` | `Json?` | Outbound: key properties sent. Inbound: `{ subscriptionType, objectId, propertyName? }`. |
| `response` | `Json?` | Hubspot response body snippet on success. |
| `error_code` | `String?` | HTTP status code or Node error code on failure. |
| `error_message` | `String?` | Error message on failure. |
| `createdAt` | `DateTime` | Record creation timestamp (`@default(now())`). |

### Indexes

| Index name | Columns | Purpose |
|---|---|---|
| `idx_hs_audit_entity_timeline` | `(entity_type, entity_id, createdAt)` | Timeline for a specific entity |
| `idx_hs_audit_actor` | `actor_user_id` | All actions by a user |
| `idx_hs_audit_actor_label` | `actor_label` | All webhook / cron entries |
| `idx_hs_audit_source` | `source` | Filter by trigger origin |
| `idx_hs_audit_success` | `success` | Quick failure scan |
| `idx_hs_audit_created_at` | `createdAt` | Time-range queries |

---

## Enums

### `HubspotEntityType`

| Value | Maps to |
|---|---|
| `candidate` | Virtual Assistant custom object (`2-5922196`) |
| `hire_request` | Hubspot tickets |
| `organization` | Hubspot companies |
| `contact` | Hubspot contacts |
| `affiliate` | Growth Partner custom object (`2-54072002`, `p20630393_growth_partners`) |
| `deal` | Hubspot deals (Staff object) |
| `owner` | Hubspot owners |
| `invoice` | Hubspot invoice object (`0-53`) |

### `HubspotAuditAction`

| Value | When used |
|---|---|
| `CREATE` | New object created in Hubspot |
| `UPDATE` | Properties or pipeline stage updated |
| `DELETE` | Object archived/deleted |
| `SYNC` | Object merge (inbound webhook) |
| `BATCH_UPDATE` | `updateManyCandidatesFromHireRequest` bulk operation |

### `HubspotAuditSource`

| Value | When used |
|---|---|
| `user_action` | Triggered by a user via the REST API (actorUserId present) |
| `cron` | Triggered by a scheduled job (no user context) |
| `webhook` | Inbound event received from Hubspot webhook |
| `bulk_sync` | Bulk synchronisation operations (`createCandidates`, `updateCandidates`, `updateOrganizations`) |

---

## Actor Resolution Rules

| Scenario | `actor_user_id` | `actor_label` | `source` |
|---|---|---|---|
| User performs action via REST API | `user.id` | `null` | `user_action` |
| Scheduled cron job | `null` | `null` | `cron` |
| Inbound Hubspot webhook | `null` | `'WebhookHubspot'` | `webhook` |
| Bulk sync operation | `null` | `'BulkSync'` | `bulk_sync` |

---

## Scope — What Gets Logged

### Outbound (we send to Hubspot)

| Service | File | Entity | Object Type | Actions |
|---|---|---|---|---|
| `HireRequestCreationService` | `create/hireRequest.ts` | `hire_request` | `tickets` | `CREATE` |
| `HireRequestUpdateService` | `update/hireRequest.ts` | `hire_request` | `tickets` | `UPDATE` |
| `OrganizationCreationService` | `create/Organization.ts` | `organization` | `companies` | `CREATE` |
| `OrganizationUpdateService` | `update/organization.ts` | `organization` | `companies` | `UPDATE` |
| `ContactCreationService` | `create/contact.ts` | `contact` | `contacts` | `CREATE` |
| `ContactFromCompanyCreationService` | `create/contactFromCompany.ts` | `contact` | `contacts` | `CREATE` |
| `ContactUpdateService` | `update/contact.ts` | `contact` | `contacts` | `UPDATE` |
| `ContactDeleteService` | `delete/contact.ts` | `contact` | `contacts` | `DELETE` |
| `CompanyDeleteService` | `delete/company.ts` | `organization` | `companies` | `DELETE` |
| `AffiliateCreationService` | `create/affiliate.ts` | `affiliate` | `p20630393_growth_partners` | `CREATE` |
| `AffiliateUpdateService.deactivate` | `update/affiliate.ts` | `affiliate` | `p20630393_growth_partners` | `UPDATE` |
| `AffiliateUpdateService.reactivate` | `update/affiliate.ts` | `affiliate` | `p20630393_growth_partners` | `UPDATE` |
| `AffiliateUpdateService.updateCommission` | `update/affiliate.ts` | `affiliate` | `p20630393_growth_partners` | `UPDATE` |
| `AffiliateUpdateService.updateBankingData` | `update/affiliate.ts` | `affiliate` | `p20630393_growth_partners` | `UPDATE` |
| `AffiliateUpdateService.clearBankingData` | `update/affiliate.ts` | `affiliate` | `p20630393_growth_partners` | `UPDATE` |
| `HubspotService.updateOneCandidateFromHireRequest` | `hubspot.service.ts` | `candidate` | `HUBSPOT_CUSTOM_OBJECT` | `UPDATE` |
| `HubspotService.updateManyCandidatesFromHireRequest` | `hubspot.service.ts` | `candidate` | `HUBSPOT_CUSTOM_OBJECT` | `BATCH_UPDATE` |

### Inbound (Hubspot sends to us via webhook)

All inbound events are logged inside `changeDataFromHubspot()` in `hubspot.service.ts` — one log entry per event processed. The `resolveWebhookMeta()` private helper maps `subscriptionType` + `objectTypeId` to the correct `entityType` / `objectType` / `action`.

| `subscriptionType` | `objectTypeId` / condition | `entity_type` | `hubspot_object_type` | `action` |
|---|---|---|---|---|
| `object.creation` / `object.restore` | `2-5922196` | `candidate` | `HUBSPOT_CUSTOM_OBJECT` | `CREATE` |
| `object.propertyChange` | `2-5922196` | `candidate` | `HUBSPOT_CUSTOM_OBJECT` | `UPDATE` |
| `object.deletion` | `2-5922196` | `candidate` | `HUBSPOT_CUSTOM_OBJECT` | `DELETE` |
| `object.merge` | `2-5922196` | `candidate` | `HUBSPOT_CUSTOM_OBJECT` | `SYNC` |
| `object.creation` / `object.restore` | `2-54072002` | `affiliate` | `p20630393_growth_partners` | `CREATE` |
| `object.propertyChange` | `2-54072002` | `affiliate` | `p20630393_growth_partners` | `UPDATE` |
| `object.creation` | `0-53` | `invoice` | `0-53` | `CREATE` |
| `object.propertyChange` | `0-53` | `invoice` | `0-53` | `UPDATE` |
| `object.associationChange` | `associationTypeId` `179` or `180` | `invoice` | `0-53` | `UPDATE` |
| `company.creation` / `company.restore` | — | `organization` | `companies` | `CREATE` |
| `company.propertyChange` | — | `organization` | `companies` | `UPDATE` |
| `company.deletion` | — | `organization` | `companies` | `DELETE` |
| `company.merge` | — | `organization` | `companies` | `SYNC` |
| `company.associationChange` | — | `organization` | `companies` | `UPDATE` |
| `deal.creation` / `deal.restore` | — | `deal` | `deals` | `CREATE` |
| `deal.propertyChange` | — | `deal` | `deals` | `UPDATE` |
| `deal.deletion` | — | `deal` | `deals` | `DELETE` |
| `deal.associationChange` | — | `deal` | `deals` | `UPDATE` |
| `ticket.deletion` | — | `hire_request` | `tickets` | `DELETE` |
| `ticket.propertyChange` | — | `hire_request` | `tickets` | `UPDATE` |
| `contact.creation` | — | `contact` | `contacts` | `CREATE` |
| `contact.propertyChange` | — | `contact` | `contacts` | `UPDATE` |
| `owners.creation` / `owners.restore` | — | `owner` | `owners` | `CREATE` |
| `owners.propertyChange` | — | `owner` | `owners` | `UPDATE` |
| `owners.deletion` | — | `owner` | `owners` | `DELETE` |

> **Note:** For inbound events, `entity_id` and `hubspot_object_id` are both set to the Hubspot `objectId` (string). No DB UUID is available at the `changeDataFromHubspot` level.  
> Events with unknown `subscriptionType` or unmatched `objectTypeId` produce `meta = null` — no audit row is written and no handler runs.

---

## `HubspotAuditService` — API

**File:** `src/hubspot/hubspot-audit.service.ts`

```typescript
interface HubspotAuditLogParams {
  actorUserId?:       string | null;   // FK to USER — human actors
  actorLabel?:        string | null;   // 'WebhookHubspot' | 'CronJob' | 'BulkSync'
  entityType:         HubspotEntityType;
  entityId:           string;
  hubspotObjectId?:   string | null;
  hubspotObjectType:  string;
  action:             HubspotAuditAction;
  source:             HubspotAuditSource;
  success:            boolean;
  payload?:           Record<string, any> | null;
  response?:          Record<string, any> | null;
  errorCode?:         string | null;
  errorMessage?:      string | null;
}

// Returns void. DB write failures are caught internally and logged to
// console.error — they never propagate to the caller.
async log(params: HubspotAuditLogParams): Promise<void>
```

---

## Call-Site Threading

`actorUserId` flows from the HTTP request context down through the service layers:

```
Controller (@CurrentUser() user: USER)
  └─ DomainService.someMethod(data, user?.id)        // e.g. hire-request.service.ts
       └─ HubspotService.createHireRequestInHubspot(data, actorUserId)
            └─ HireRequestCreationService.execute(data, actorUserId)
                 └─ this.audit.log({ actorUserId, ... })
```

**Services updated to accept and forward `actorUserId`:**

| Service | Method(s) updated |
|---|---|
| `hire-request.service.ts` | ~30 call sites threaded |
| `organization.service.ts` | `create`, `update` |
| `user.service.ts` | `update`, `delete`, `inviteUserToOrganization` |
| `referred-companies.service.ts` | `deleteCompanyInHubspot`, `deleteContactInHubspot` |
| `organization.controller.ts` | `update` — added `@CurrentUser()` |
| `user.controller.ts` | `updateUser`, `updateUserProfile`, `deleteUser` |

**`source` inference rule** (applied in every sub-service):
```typescript
const source = actorUserId ? HubspotAuditSource.user_action : HubspotAuditSource.cron;
```

---

## Module Registration

**`src/hubspot/hubspot.module.ts`**

- `HubspotAuditService` added to `providers` (receives `PrismaService` via injection).
- `HubspotAuditService` added to `exports` (available to any module that imports `HubspotModule`).

---

## Test Coverage

7 spec files, 88 tests — all passing.

| Spec file | Tests | Covers |
|---|---|---|
| `hubspot-audit.service.spec.ts` | 14 | DB write, field coercion, fire-and-forget safety, all source values |
| `create/hireRequest.spec.ts` | 11 | CREATE success/failure, DB back-write, source inference, error capture |
| `update/hireRequest.spec.ts` | 11 | UPDATE success/failure, `specificField` payload vs fields list, entityId fallback chain |
| `delete/contact.spec.ts` | 8 | DELETE success/failure, entityId fallback, source inference |
| `delete/company.spec.ts` | 8 | DELETE success/failure, DB entityId preferred over Hubspot ID, network error capture |
| `update/affiliate.spec.ts` | 20 | All 5 affiliate methods × success + failure + payload + source |
| `hubspot-webhook-audit.spec.ts` | 36 | All `subscriptionType` → entity mappings, `actor_label='WebhookHubspot'`, handler failure → `success=false` + error re-thrown, unknown events → no log, batch processing, payload shape |

---

## Verification Queries

After deploying, confirm rows are being written:

```sql
-- Most recent audit entries
SELECT actor_user_id, actor_label, entity_type, action, source, success, "createdAt"
FROM "HubspotAuditLog"
ORDER BY "createdAt" DESC
LIMIT 20;

-- All failures in the last 24 hours
SELECT entity_type, action, error_code, error_message, "createdAt"
FROM "HubspotAuditLog"
WHERE success = false
  AND "createdAt" > NOW() - INTERVAL '24 hours'
ORDER BY "createdAt" DESC;

-- Timeline for a specific hire request
SELECT action, source, actor_user_id, actor_label, success, "createdAt"
FROM "HubspotAuditLog"
WHERE entity_type = 'hire_request'
  AND entity_id = '<hr-uuid>'
ORDER BY "createdAt" ASC;

-- All webhook events (inbound from Hubspot)
SELECT entity_type, action, hubspot_object_id, success, payload, "createdAt"
FROM "HubspotAuditLog"
WHERE actor_label = 'WebhookHubspot'
ORDER BY "createdAt" DESC
LIMIT 50;
```
