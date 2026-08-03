# Med Alliance — Eligibility & Commission Rules

> This document describes the business rules implemented in the backend for referral eligibility, commission detection, and payout flow. References use file paths relative to `src/`.

---

## 1. `deployment_date` — What it is and when it is set

**Field:** `Organization.deployment_date` (DateTime, nullable)
**Description:** The date when the client organization deployed their first VA. Synced from HubSpot via the property `deploy_date_of_first_va`. Eligibility decisions (Confirm/Block) become available to admins as soon as this is set and in the past — there is no waiting period.

### Where it is set

#### 1.1. Via HubSpot webhook
**File:** [hubspot/handlers/organizationPropertyChange.ts](../src/hubspot/handlers/organizationPropertyChange.ts)

When the `deploy_date_of_first_va` property changes in HubSpot, the handler first checks whether the incoming value actually differs from the organization's current `deployment_date` (a no-op guard — HubSpot can re-deliver a webhook for an unchanged value, and this must never overwrite a manual admin decision). If the value genuinely changed:

| Scenario | Action |
|----------|--------|
| Received `deployment_date` is `null` | Clears `deployment_date` and `eligibility_start_at`, moves `referral_stage` to `in_negotiation`, sets `med_alliance_referral_status = pending_confirmation` |
| `deployment_date` is more than 365 days in the past | Sets `deployment_date`, sets `eligibility_start_at = deployment_date` (no offset), sets `referral_stage = deployed`, sets `med_alliance_referral_status = expired` directly — no decision window |
| `deployment_date` is 365 days ago or less, **or** in the future | Sets `deployment_date`, sets `eligibility_start_at = deployment_date`, sets `referral_stage = deployed`, sets `med_alliance_referral_status = pending_confirmation`. A future date still lands on `deployed`+`pending_confirmation` here — `approveEligibility` is what actually rejects confirming a future-dated deployment |

#### 1.2. Via first paid invoice (automatic detection)
**File:** [med-alliance/sync/commission-detection.service.ts](../src/med-alliance/sync/commission-detection.service.ts) — method `markDeployed()`

Fallback path for when no HubSpot `deployment_date` webhook has fired yet. When the first paid invoice is detected for a referred organization, the system:
- Sets `referral_stage = deployed`
- Sets `eligibility_start_at = invoice_date` (no offset)
- Sets `first_paid_invoice_at = invoice_date`
- Does **not** set `deployment_date` directly (that field comes from HubSpot)
- `med_alliance_referral_status` is left untouched — Confirm/Block become available to admins immediately, there is no wait

#### 1.3. Via manual stage update by admin
**File:** [med-alliance/referred-companies/referred-companies.service.ts](../src/med-alliance/referred-companies/referred-companies.service.ts) — method `updateReferralStage()`

When an admin manually moves the organization to `deployed`, the system uses the existing `deployment_date` as the anchor for `eligibility_start_at`. If `deployment_date` is null, it falls back to the current time. This does **not** touch `med_alliance_referral_status` — if an admin moves the stage to `deployed` without a real `deployment_date`, `approveEligibility`'s own guard (`deployment_date` must be set and in the past) still protects against premature confirmation.

---

## 2. `referral_stage` — Lifecycle and transitions

**Field:** `Organization.referral_stage` (enum `ReferralStage`)
**Default:** `referred`

### Enum values

```
referred → contacted → in_negotiation → contract_signed → deployed → canceled
```

> **Note:** `canceled` (with z) is the correct enum value. Do not confuse with `HireRequestStatus` which uses `cancelled` (with ll).

### 2.1. Initial state
Set to `referred` when a referred company is created.

### 2.2. Manual transitions (admin)
The admin can move the organization to any stage via `PATCH /med-alliance/referred-companies/{id}/stage`. Every change is recorded in `MedAllianceAuditLog`.

### 2.3. Automatic transitions

| Trigger | New Stage | File |
|---------|-----------|------|
| First paid invoice detected (only if stage is not already `deployed` or `canceled`) | `deployed` | `commission-detection.service.ts` → `markDeployed()` |
| HubSpot sends `deploy_date_of_first_va` as `null` (genuine change, not a re-delivery of the same value) | `in_negotiation` | `organizationPropertyChange.ts` |
| HubSpot sends any `deploy_date_of_first_va` value — past, recent, or future | `deployed` | `organizationPropertyChange.ts` |

> **Idempotency rule:** `markDeployed()` only runs if `org.first_paid_invoice_at` is still null. Organizations already in `deployed` or `canceled` never revert via automatic detection. The HubSpot webhook handler additionally no-ops if the incoming `deployment_date` value is unchanged from the stored value, so a re-delivered webhook can never revert an org that a human has since moved along (e.g. to `contract_signed`).

---

## 3. `eligibility_start_at` — What it is and when it is set

**Field:** `Organization.eligibility_start_at` (DateTime, nullable)
**Description:** Set to the organization's `deployment_date` (or, as a fallback, the first paid invoice date) once it is deployed. There is no longer a 30-day stabilization offset baked into this field — it is the raw deployment/first-invoice timestamp, used for display and as the anchor for `approveEligibility`'s `backfill` computation.

### When it is set/updated

| Action | Value | File |
|--------|-------|------|
| First paid invoice detected (fallback deploy trigger) | `firstInvoiceDate` | `commission-detection.service.ts` |
| HubSpot sync with any non-null `deployment_date` | `deploymentDate` | `organizationPropertyChange.ts` |
| HubSpot sync with a null `deployment_date` | Cleared (null) | `organizationPropertyChange.ts` |
| Admin manually sets stage to `deployed` | `deployment_date` (or `now()` if `deployment_date` is null), **only if not already set** | `referred-companies.service.ts` |

### When the window expires

The field is **preserved** (not cleared) when the org expires — it remains a permanent record of when the company was deployed. `med_alliance_block_reason` is cleared to `null` on expiry; there is no more magic string encoding it (see §4 — `expired` is now a real status value).

---

## 4. `med_alliance_referral_status` — Organization eligibility flag

**Field:** `Organization.med_alliance_referral_status` (enum `MedAllianceReferralStatus`)
**Values:** `pending_confirmation` (shown as **Pending** in the UI) | `eligible` | `not_eligible` (shown as **Blocked**) | `expired`
**Default:** `pending_confirmation`, set explicitly at referral creation. `pending_confirmation` is the resting state — a referral stays there through every non-deployed pipeline stage, with no automatic age-based cutoff.

### 4a. Admin decision endpoints and their guard matrix

Decisions (**Confirm as Eligible** / **Block Eligibility**) are only ever available once `referral_stage = 'deployed'` (i.e. `deployment_date` is set). The two endpoints share a guard helper (`ReferredCompaniesService.assertDeployedDecisionAllowed`) that enforces this exact matrix:

| Current status | Confirm allowed? | Block allowed? |
|---|---|---|
| `pending_confirmation` (Pending) | Yes | Yes |
| `eligible` | No (already eligible) | Yes |
| `not_eligible` (Blocked) | Yes (un-block) | No (already blocked) |
| `expired` | No | No |

- **`PATCH .../:id/approve-eligibility`** (`approveEligibility`) — additionally rejects with `'Company has not been deployed yet'` if `deployment_date` is null, and rejects with `'deployment date is in the future'` if `deployment_date > now()`. This applies whether confirming from `pending_confirmation` or from `not_eligible`. The existing `backfill` flag (promote past `detected` commissions vs. void them and re-anchor) is unchanged.
- **`PATCH .../:id/block-eligibility`** (`blockEligibility`) — the request now requires `commissions_action: 'void' | 'keep'`. `'void'` behaves as before (voids `detected`/`pending_admin_confirmation` commissions); `'keep'` leaves them completely untouched.
- **`PATCH .../:id/revert-eligibility` no longer exists.** It was removed — with `pending_confirmation` as the default resting state, "re-open for review" has no role. The only way to move a `not_eligible` (Blocked) org back to `pending_confirmation` other than a direct Confirm is a genuine `deployment_date` change in HubSpot (§1.1 — clearing it moves to `in_negotiation`/`pending`; changing it to a still-within-365-days value re-lands on `deployed`/`pending`).

### Transitions to `expired`

| Cause | File |
|-------|------|
| HubSpot sync: `deployment_date` is set and already more than 365 days in the past | `organizationPropertyChange.ts` |
| Cron sweep: any `deployed` org (regardless of current status, except already-`expired`) whose `deployment_date` has passed 365 days | `cron.service.ts` → `expireStaleEligibility()` |
| Inline backstop during commission detection/sync — same 365-day rule, keeps a company correct between cron runs | `commission-detection.service.ts` → `expireEligibility()` |

Canceled organizations (`referral_stage = 'canceled'`) are structurally excluded from all of the above — an org cannot be `deployed` and `canceled` at the same time, so no separate guard is needed (see §5, State 8 / the informal "canceled orgs never generate commissions" rule).

### Transitions to `pending_confirmation`

| Cause | File |
|-------|------|
| Referral creation (initial state) | `referred-companies.service.ts` |
| HubSpot sync: `deployment_date` cleared, or set to a value ≤365 days in the past (including future dates) | `organizationPropertyChange.ts` |
| Admin resolves a `multiple_hubspot_matches` review case and assigns the correct hubspot_id — unless the org's current status is `eligible` or `expired`, which is left untouched | `review-cases.service.ts` |

### Transitions to `not_eligible` (Blocked)

| Cause | File |
|-------|------|
| Admin clicks Block Eligibility (from `pending_confirmation` or `eligible`) | `referred-companies.service.ts` |
| MA-004 block: organization matches an active non-referred client (by hubspot_id or email) — a separate concern from the rest of this state machine, never touched by the eligibility refactor | `eligibility-check.service.ts` |

### Transitions to `eligible`

| Cause | File |
|-------|------|
| Admin clicks Confirm as Eligible (from `pending_confirmation` or `not_eligible`, only while `deployment_date` is in the past) | `referred-companies.service.ts` |

---

## 5. Eligibility Window — Time-based rules

**File:** `med-alliance/sync/commission-detection.service.ts`

**Constant:**
- `ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000`

There is no more 30-day constant anywhere in this flow — decisions are available immediately once deployed.

### Full eligibility lifecycle

```
State 1 — Not yet deployed (any pipeline stage before 'deployed'):
  referral_stage = referred | contacted | in_negotiation | contract_signed
  med_alliance_referral_status = pending_confirmation (the resting state)
  → No automatic age-based cutoff. A referral can sit here indefinitely.
  → No commissions are created (no paid invoices exist yet at this stage in practice).

State 2 — Deployed, awaiting admin decision:
  referral_stage = deployed
  eligibility_start_at = deployment_date (or first paid invoice date, no offset)
  med_alliance_referral_status = pending_confirmation
  → Confirm/Block are both available immediately — no waiting period.
  → New commissions created as 'detected' (hidden from admin/affiliate) until an admin confirms.

State 3 — Admin confirmed eligible:
  referral_stage = deployed
  med_alliance_referral_status = eligible
  → New commissions created directly as 'pending_admin_confirmation'.
  → Existing 'detected' commissions are promoted to 'pending_admin_confirmation' (if backfill=true)
    or voided and eligibility_start_at re-anchored to now (if backfill=false).

State 4 — Admin blocked:
  referral_stage = deployed
  med_alliance_referral_status = not_eligible
  med_alliance_block_reason = admin-supplied reason
  → Existing detected/pending_admin_confirmation commissions are voided or left untouched,
    per the commissions_action ('void' | 'keep') the admin chose when blocking.
  → Stays not_eligible until either: an admin clicks Confirm directly, or deployment_date
    changes in HubSpot (which re-opens it as pending_confirmation).

State 5 — More than 365 days since deployment_date:
  med_alliance_referral_status = expired
  med_alliance_block_reason = null
  → Terminal — no further Confirm/Block decisions possible.
  → New invoices are ignored; no commissions are created.
  → Enforced by three independent, idempotent writers of the same rule: the HubSpot webhook
    (if deployment_date syncs in already >365 days old), the commission-detection inline
    backstop (on every sync touch), and the expireStaleEligibility() cron sweep.

State 6 — Active client block (MA-004, unrelated to the rest of this state machine):
  med_alliance_block_reason = 'active_client_block: ...'
  → Commission creation permanently blocked. Never touched by the eligibility refactor above.

State 7 — Organization canceled (referral_stage = canceled):
  → Commission creation permanently blocked. Structurally excluded from every deployed-only
    query (an org can't be both 'deployed' and 'canceled'), so no separate guard is needed
    in most places — this is the rule sometimes informally referred to as "BR-13", though
    that label does not appear anywhere in this codebase.
```

Note: the old "State 6 — referral older than 1 year with no paid invoice" rule (a permanent commission-detection skip based on referral age alone) has been removed — it conflicted with `pending_confirmation` being a true no-automatic-cutoff resting state.

---

## 6. AffiliateCommission — Lifecycle

**Primary files:** `med-alliance/sync/commission-detection.service.ts`, `med-alliance/commissions/commissions.service.ts`

### Status flow

```
detected
    ↓ (cron: 30 days since deploy)
pending_admin_confirmation
    ↓ (admin approves)        ↘ (admin rejects)
eligible                        rejected (terminal)
    ↓ (affiliate requests payout)
requested
    ↓ (payout paid)
paid (terminal)

From any non-terminal status:
    → void (forced by admin; can be reverted to detected or pending_admin_confirmation)
```

### Commission detection rules

A HubSpot invoice generates a commission **only if**:
1. `invoice_status = 'paid'`
2. `invoice_amount > 0`
3. `payment_status = null` OR `payment_status = 'succeeded'`
4. The organization is `eligible` OR still within the detection period (< 30 days since deploy)
5. Idempotency: unique `idempotency_key` per (invoice_hubspot_id, organization_id)

### Commission amount calculation

```
commission_amount = invoice_amount × (affiliate.commission_percent_default / 100)
                    rounded to 2 decimal places
```

### Visibility by profile

| Status | Affiliate sees? | Admin sees? |
|--------|----------------|-------------|
| `detected` | No | Yes |
| `pending_admin_confirmation` | No | Yes |
| `eligible` | Yes | Yes |
| `requested` | Yes | Yes |
| `paid` | Yes | Yes |
| `rejected` | Yes | Yes |
| `void` | No | Yes |

---

## 7. AffiliatePayoutRequest — Lifecycle

**File:** `med-alliance/payout-requests/payout-requests.service.ts`

### Status flow

```
requested
    ↓ (admin moves to review)
under_review
    ↓ (admin approves)
approved
    ↓ (admin marks as paid)
paid (terminal)

At any point:
requested / under_review / approved → rejected (terminal)
requested / under_review / approved → cancelled (terminal)
```

### Creation by affiliate

1. Affiliate selects one or more commissions with status `eligible`
2. System validates that all commissions belong to the requesting affiliate
3. Creates `AffiliatePayoutRequest` with status `requested`
4. `requested_amount` = sum of the selected commission amounts
5. All selected commissions transition to status `requested`
6. Admin is notified

### Creation by admin

Same flow, but the origin is recorded as `admin_action` in the audit log.

### Cancellation / Rejection

- Linked commissions revert to status `eligible`
- `cancellation_reason` or `rejection_reason` are recorded

---

## 8. HubspotInvoiceSnapshot — Ingestion and detection

**File:** `med-alliance/sync/invoice-ingestion.service.ts`

### When snapshots are created

Snapshots are created/updated during the Med Alliance sync flow (Phase B):

1. System fetches all invoice IDs associated with the HubSpot company
2. For each invoice, fetches full details including payment associations
3. Upsert logic:
   - **Does not exist:** CREATE the snapshot
   - **Exists + `sync_hash` unchanged:** SKIP (no change)
   - **Exists + `sync_hash` changed:** UPDATE the snapshot and open a MA-006 review case

### `sync_hash` — monitored fields

SHA-256 of: `hubspot_id | invoice_status | payment_status | invoice_amount | currency | paid_at | due_date | invoice_number`

### Commission detection trigger

After snapshots are updated, the system runs `detectCommissions()` which:
- Filters `paid` snapshots with `invoice_amount > 0`
- For each one, attempts to create an `AffiliateCommission` (idempotent via `idempotency_key`)

---

## 9. MedAllianceAdminReviewCase — Manual review cases

**File:** `med-alliance/review-cases/review-cases.service.ts`

### Deduplication constraint

At most **1 open case** per (organization_id + reason_code). Calls to `openOrSkip()` with the same pair are silently ignored.

### Reason codes and when they are opened

#### `multiple_hubspot_matches`
- **Trigger:** Phase A of the sync finds 2+ HubSpot companies matching the same referral
- **Effect:** Sync pipeline halted; `med_alliance_referral_status = not_eligible`
- **Resolution:** Admin provides the correct `hubspot_company_id` → `med_alliance_referral_status = eligible`
- **File:** `hubspot-matching.service.ts`

#### `reconciliation_invoice_changed`
- **Trigger:** A paid invoice that already had a commission detected was updated in HubSpot (detected by `sync_hash` change)
- **Effect:** Admin is notified; existing commission is held pending a decision
- **Resolution:**
  - `void_and_recreate`: Old commission is voided; next sync re-detects at the new amount
  - `keep_existing`: Case is closed without changes
- **File:** `invoice-ingestion.service.ts`

#### `soft_duplicate_referral`
- **Trigger:** New referral has the same name or email as an existing referral
- **Effect:** **Advisory only** — referral is NOT blocked; admin receives a warning
- **Resolution:** Manual close with no side effects
- **File:** `referred-companies.service.ts`

#### `org_deleted_with_pending_payout`
- **Trigger:** A referred organization is deleted in HubSpot while it still has commissions in `requested` status (i.e. inside a pending payout request)
- **Effect:** Requested commissions are **NOT** auto-voided — money is already in a payout flow, so an admin must decide pay vs void; case metadata carries the affected `commission_ids`
- **Resolution:** Manual close (admin either lets the payout proceed or voids the commissions from the commissions admin screen)
- **File:** `med-alliance/org-deletion/org-deletion.service.ts`

---

## 10. Organization deletion — Med Alliance side effects

**File:** `med-alliance/org-deletion/org-deletion.service.ts` (`OrgDeletionService.onOrganizationDeleted()`), invoked by `hubspot/handlers/organizationDeletion.ts` right after the org is soft-deleted (`status = deleted`, `deletedAt` set, users → `inactive`).

**Triggers of the soft delete:** the HubSpot `company.deletion` webhook, or a `business_unit` property change to a value other than MedVirtual/Berry Virtual (`organizationPropertyChange.ts`).

### What the hook does (no-op for non-referred orgs)

| Commission status at deletion time | Effect |
|-----------------------------------|--------|
| `detected`, `pending_admin_confirmation`, `eligible` | Auto-voided (`status = void`); one audit log entry per commission with `event: 'voided_org_deleted'`, `reason: 'org_deleted'`, `source: 'sync'` |
| `requested` (inside a pending payout request) | NOT voided — a `MedAllianceAdminReviewCase` with reason `org_deleted_with_pending_payout` is opened so an admin decides pay vs void |
| `paid`, `void`, `rejected` (terminal) | Untouched |

Additionally the hook:
1. Auto-resolves any **other** open review cases for the org (they are no longer actionable) with a fixed resolution note
2. Writes an org-level audit log entry: `entity_type: 'referred_company'`, `event: 'organization_deleted'`, `source: 'sync'`, metadata carries `commissions_voided` and `commissions_in_pending_payout` counts
3. Notifies admins via `AllianceNotificationsService.notifyAdminReferredOrgDeleted` (template `admin-referred-org-deleted.ts`, editable key `alliance-admin-referred-org-deleted`)

### Guards that keep a deleted org out of the pipeline

| Guard | File | Behavior |
|-------|------|----------|
| Sync pipeline pre-check | `med-alliance/sync/referral-sync.service.ts` (`run()`, top) | Returns `phaseA.outcome = 'skipped_deleted'` before Phase A — covers the bulk cron, the single-org cron param, and the admin manual-sync endpoint |
| Commission detection | `med-alliance/sync/commission-detection.service.ts` (`run()`, top) | Returns zeros for deleted orgs (would otherwise re-detect commissions the hook just voided) |
| Eligibility decisions | `med-alliance/referred-companies/referred-companies.service.ts` (`assertNotDeleted()`) | `approveEligibility` / `blockEligibility` throw `Cannot change eligibility of a deleted organization` |
| Payout request creation | `med-alliance/payout-requests/payout-requests.service.ts` (`create()`) | Rejects any commission whose organization has `status = deleted` |
| Eligible-invoices list | `med-alliance/invoices/invoices.service.ts` (`getEligibleInvoicesForAffiliate()`) | Org query adds `status: { not: 'deleted' }` |
| `deployment_date` webhook | `hubspot/handlers/organizationPropertyChange.ts` (deployment_date branch) | Returns early for deleted orgs — a stray webhook can no longer flip `referral_stage` / `med_alliance_referral_status` back to life |
| Expiry cron sweep | `cron/cron.service.ts` (`expireStaleEligibility()`) | Query adds `status: { not: 'deleted' }` |
| Per-affiliate detection | `cron/cron.service.ts` (`detectCommissionsByAffiliate()`) | Query adds `status: { not: 'deleted' }` |
| Populate hard-delete | `organization/organization.service.ts` (`populateDbFromHubspot*`) | `deleteMany` excludes orgs with `referred_by_affiliate_id != null` (FK Restrict on commissions/snapshots/review cases would crash anyway; this also preserves referral history) |

### Reactivation / restore semantics

Two webhook paths bring a soft-deleted organization back, both **updating the existing row in place** (never recreating it — that would orphan the Med Alliance referral history attached to the current `id`):

| Trigger | Handler | Result |
|---------|---------|--------|
| `business_unit` changed back to MedVirtual / Berry Virtual | `hubspot/handlers/organizationReactivation.ts` | `status = inactive`, `deletedAt = null`, `business_unit` updated |
| `company.restore` webhook (company un-archived in HubSpot) | `hubspot/handlers/organizationRestore.ts` | `status = inactive`, `deletedAt = null`. Falls back to `HandlerOrganizationCreation` only when the company was never synced |

> Before July 2026, `company.restore` was routed to `HandlerOrganizationCreation`, which threw `'Organization already exists on the database'` and left the org soft-deleted forever. `hubspot.service.ts` now routes it to the dedicated restore handler.

Both paths land on `inactive`, not `active` — same rule as organization creation: a human (or a deal/staff event) must activate.

Commissions voided by the deletion **stay voided** on either path — there is no automatic un-void. They are identifiable by `reason: 'org_deleted'` in their audit trail, and an admin can restore them individually via the existing manual `unvoid` flow (`med-alliance/commissions/commissions.service.ts`, `unvoid()`).

---

## 11. Related Cron Jobs

**File:** `cron/cron.service.ts`. Note there is no `@Cron`/`CronExpression` usage anywhere in this codebase — these are plain HTTP GET endpoints (`cron/cron.controller.ts`) presumably polled by an external scheduler outside this repo.

### `expireStaleEligibility()`
Replaces the old `promoteDeployedCompanies()` — 30-day promotion no longer exists, so there is nothing left to "promote." This is purely an expiry sweep now.
- **Route:** `GET /cron/expire-stale-eligibility` (renamed from `/cron/promote-deployed-companies` — any external scheduler config must be updated to the new path)
- **What it does:**
  1. Finds organizations with `referral_stage = deployed`, a non-null affiliate referral, `deployment_date` more than 365 days ago, and `med_alliance_referral_status` in `pending_confirmation | eligible | not_eligible` (i.e. anything not already `expired`)
  2. Sets `med_alliance_referral_status = expired` and clears `med_alliance_block_reason`
  3. Records an audit log entry per organization with `event: 'eligibility_expired'`, `source: 'cron'`
  4. Sends an email report (`medAllianceExpiredEligibilityReport`) if any organizations were expired

`syncOrganizationsWithHubspot()` no longer has an inline 30-day-promotion block — it only runs the HubSpot matching/invoice-ingestion sync pipeline per organization.

---

## 12. Field state matrix

| Field | referred / contacted / in_negotiation / contract_signed | deployed (≤ 365 days since deployment_date) | deployed, admin confirmed eligible | deployed, admin blocked | deployed (> 365 days since deployment_date) | canceled |
|-------|---|---|---|---|---|---|
| `referral_stage` | matches stage | `deployed` | `deployed` | `deployed` | `deployed` | `canceled` |
| `med_alliance_referral_status` | `pending_confirmation` | `pending_confirmation` | `eligible` | `not_eligible` | `expired` | — |
| `eligibility_start_at` | null | `deployment_date` | anchor set at confirm time | null | `deployment_date` (preserved) | — |
| `first_paid_invoice_at` | null | date of 1st invoice (if any) | date of 1st invoice | date of 1st invoice | date of 1st invoice | — |
| New commissions created as | — (no invoices yet in practice) | `detected` | `pending_admin_confirmation` | `detected` (still created, awaiting a decision) | none | none |

---

## 13. Quick file reference

| Concept | File | Key lines |
|---------|------|-----------|
| `deployment_date` sync via HubSpot | `src/hubspot/handlers/organizationPropertyChange.ts` | full `execute()` method |
| `markDeployed()` — first invoice detected (fallback path) | `src/med-alliance/sync/commission-detection.service.ts` | `markDeployed()` private method |
| `expireEligibility()` — inline expiry backstop | `src/med-alliance/sync/commission-detection.service.ts` | `expireEligibility()` private method |
| Admin decision guard matrix | `src/med-alliance/referred-companies/referred-companies.service.ts` | `assertDeployedDecisionAllowed()` (~line 803) |
| Manual stage update | `src/med-alliance/referred-companies/referred-companies.service.ts` | `updateReferralStage()` (~line 985) |
| Commission detection (main loop) | `src/med-alliance/sync/commission-detection.service.ts` | `run()` (~line 46) |
| One-year constant | `src/med-alliance/sync/commission-detection.service.ts` | top of file |
| Eligibility expiry cron sweep | `src/cron/cron.service.ts` | `expireStaleEligibility()` (~line 1013) |
| Payout request creation | `src/med-alliance/payout-requests/payout-requests.service.ts` | `create...` methods |
| HubSpot invoice ingestion | `src/med-alliance/sync/invoice-ingestion.service.ts` | `run()` |
| HubSpot matching (Phase A) | `src/med-alliance/sync/hubspot-matching.service.ts` | `run()` / `handleMultipleMatches()` |
| Review case open/resolve | `src/med-alliance/review-cases/review-cases.service.ts` | `resolve()` |
| MA-004 active client block | `src/med-alliance/referred-companies/eligibility-check.service.ts` | `runAndPersist()` (~line 95) |
