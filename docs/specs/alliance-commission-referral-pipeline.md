# Spec: Alliance Commission & Referral Pipeline

**Feature:** Med Alliance — Pipeline Stage Tracking + 30-Day Maturity Gate  
**Status:** Implemented (pending Prisma migration)  
**Date:** 2026-05-05

---

## 1. Overview

Two interrelated changes shipped together:

| Change | Summary |
|--------|---------|
| **Pipeline stage tracking** | Referred companies move through a 6-stage lifecycle instead of the old binary `not_eligible / eligible` model. Admins can manually move companies between stages via a new PATCH endpoint. |
| **30-day maturity gate** | Commissions only reach admin review after a company has been *deployed for 30 days*. First invoice → `deployed` stage → cron promotes after 30 days → commissions promoted from `detected` → `pending_admin_confirmation`. |

---

## 2. Pipeline Stages

```
referred → contacted → in_negotiation → contract_signed → deployed → churned
```

| Stage | Meaning | Transitions |
|-------|---------|-------------|
| `referred` | Company was just submitted | Auto-default on creation |
| `contacted` | Affiliate/admin has reached out | Manual (admin) |
| `in_negotiation` | Active discussions ongoing | Manual (admin) |
| `contract_signed` | Agreement signed | Manual (admin) |
| `deployed` | First paid HubSpot invoice received | Auto (sync) OR manual (admin) |
| `churned` | Company stopped using the service | Manual (admin) |

**Churned companies** stop generating commissions entirely (enforced in `CommissionDetectionService`).

---

## 3. Data Model Changes

### `prisma/schema.prisma`

**New enum:**
```prisma
enum ReferralStage {
  referred
  contacted
  in_negotiation
  contract_signed
  deployed
  churned
}
```

**New field on `Organization`:**
```prisma
referral_stage  ReferralStage?  @default(referred)
```

**New index:**
```prisma
@@index([referral_stage, eligibility_start_at], map: "idx_organizations_referral_stage")
```

### Semantic change: `eligibility_start_at`

| Before | After |
|--------|-------|
| Set to the date of the first paid invoice | Set to `NOW()` when the first invoice arrives (= deployment date) |
| Cleared to `null` on expiry | **Never cleared** — permanently records the deployment date |
| Anchor for the one-year expiry window | Still the anchor for both the 30-day gate AND the one-year window |

`first_paid_invoice_at` remains unchanged: it records the actual invoice date and is never modified after being set.

### Migration + backfill

```sql
-- Already-eligible companies → deployed
UPDATE "Organization"
SET referral_stage = 'deployed'
WHERE referred_by_affiliate_id IS NOT NULL
  AND med_alliance_referral_status = 'eligible';

-- Had invoices but window expired → deployed
UPDATE "Organization"
SET referral_stage = 'deployed'
WHERE referred_by_affiliate_id IS NOT NULL
  AND first_paid_invoice_at IS NOT NULL
  AND (referral_stage IS NULL OR referral_stage = 'referred');
```

---

## 4. Commission Lifecycle

```
detected  ──(cron: 30 days)──►  pending_admin_confirmation  ──(admin approve)──►  eligible
                                                             ──(admin reject)───►  rejected
void  ◄──(admin void)──  any non-terminal status
pending_admin_confirmation  ◄──(admin revert)──  eligible
```

### `DECIDABLE_STATUSES`

Only `['pending_admin_confirmation']`. `detected` was removed — commissions in `detected` must pass through the 30-day cron before admins can decide on them.

### Commission status at creation

| Condition | Status assigned |
|-----------|----------------|
| org `not_eligible` (standard deployed state) | `detected` |
| org `eligible` but `eligibility_start_at` < 30 days ago | `detected` |
| org `eligible` and `eligibility_start_at` >= 30 days and <= 1 year ago | `pending_admin_confirmation` |
| org `churned` | No commission created |

---

## 5. Files Changed

| File | Change type | Summary |
|------|-------------|---------|
| `prisma/schema.prisma` | Schema | Added `ReferralStage` enum + `referral_stage` field + index |
| `src/med-alliance/commissions/commissions.service.ts` | Business logic | DECIDABLE_STATUSES, revertToPending, unvoid, updateBaseAmount |
| `src/med-alliance/commissions/commissions.controller.ts` | Route | `/revert-to-detected` → `/revert-to-pending` |
| `src/med-alliance/sync/commission-detection.service.ts` | Business logic | markDeployed, churned guard, dynamic status, expireEligibility fix |
| `src/med-alliance/referred-companies/referred-companies.service.ts` | Business logic | computeEffectiveStatus 30-day gate, updateReferralStage, new filters |
| `src/med-alliance/referred-companies/referred-companies.controller.ts` | Route | PATCH `/admin/referred-companies/:id/stage` |
| `src/med-alliance/referred-companies/dto/update-referral-stage.dto.ts` | DTO | New file |
| `src/med-alliance/referred-companies/dto/list-referred-companies.dto.ts` | DTO | Added `referral_stage`, `med_alliance_referral_status`, `affiliate_user_id` filters |
| `src/cron/cron.service.ts` | Cron | `promoteDeployedCompanies()` method |
| `src/cron/cron.controller.ts` | Route | GET `/cron/promote-deployed-companies` |

---

## 6. API Reference

### PATCH `/med-alliance/admin/referred-companies/:id/stage`

Moves a referred company to a new pipeline stage. Requires `ADMIN_ROLES`.

**Request body:**
```json
{
  "stage": "contacted",
  "reason": "Optional human-readable reason"
}
```

**Behavior:**
- Moving to `deployed` with no prior `eligibility_start_at` starts the 30-day clock (sets `eligibility_start_at = NOW()`).
- Moving to `deployed` when `eligibility_start_at` is already set does NOT overwrite it.
- All stage changes are recorded in `MedAllianceAuditLog`.
- Returns the full admin view of the referred company (`findOneForAdmin`).

---

### GET `/med-alliance/admin/referred-companies`

Added three new optional query parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `referral_stage` | `ReferralStage` | Filter by pipeline stage |
| `med_alliance_referral_status` | `MedAllianceReferralStatus` | Filter by eligibility status |
| `affiliate_user_id` | `UUID` | Filter by referring affiliate user id |

The response now includes `referral_stage` and `hubspot_id` on each row.

---

### GET `/med-alliance/admin/referred-companies/:id`

Response now includes `referral_stage`.

---

### PATCH `/med-alliance/admin/commissions/:id/revert-to-pending`

Replaces the old `/revert-to-detected` endpoint. Reverts an `eligible` commission back to `pending_admin_confirmation`.

---

### GET `/cron/promote-deployed-companies`

Idempotent cron endpoint. Finds all orgs with:
- `referral_stage = deployed`
- `eligibility_start_at` between 30 days ago and 1 year ago
- `med_alliance_referral_status = not_eligible`

For each: promotes org to `eligible`, promotes all `detected` commissions to `pending_admin_confirmation`, writes audit logs.

**Response:**
```json
{
  "status": 200,
  "message": "Deployed companies promotion completed",
  "data": {
    "companiesPromoted": 3,
    "commissionsPromoted": 7,
    "errors": []
  }
}
```

---

## 7. Key Business Rules

### 30-day stabilization gate

A referred company must be in the `deployed` stage for **30 days** before:
1. The cron marks it `eligible`
2. New commissions go to `pending_admin_confirmation` (instead of `detected`)
3. `computeEffectiveStatus()` returns `eligible` (read-time enforcement)

`computeEffectiveStatus()` is applied at query time in all list/detail endpoints so the UI always reflects the real state even before the cron runs.

### One-year window

Commissions stop being generated 1 year after `eligibility_start_at` (the deployment date). The expiry sets `med_alliance_block_reason = 'eligibility_expired: ...'` and is checked on subsequent sync runs to skip processing.

### Churned guard

If a company's `referral_stage` is `churned`, commission detection is skipped entirely. No commissions are created, and no `markDeployed` is triggered even if new invoices arrive.

### Idempotency

`markDeployed` only fires if:
- `first_paid_invoice_at` is null (first invoice ever), AND
- `referral_stage` is NOT already `deployed` or `churned`

The `promoteDeployedCompanies` cron is idempotent: once an org is promoted to `eligible`, it no longer matches the `not_eligible` filter and won't be processed again.

---

## 8. Test Coverage

All new and modified logic is covered by unit tests. 131 tests pass across 4 spec files.

| Spec file | New tests added | Coverage areas |
|-----------|----------------|----------------|
| `commissions.service.spec.ts` | 20 | `revertToPending`, `unvoid` (eligible/not_eligible branching), `updateBaseAmount` (both statuses), `detected` no longer decidable, MA-004 guard with correct status |
| `commission-detection.service.spec.ts` | 12 | `markDeployed` on first invoice, churned guard, dynamic commission status, expiry without nulling `eligibility_start_at`, `eligibility_expired` skip guard |
| `referred-companies.service.spec.ts` | 14 | `computeEffectiveStatus` 30-day gate (4 edge cases), `updateReferralStage` (5 cases), new admin filter params |
| `cron.service.spec.ts` | 9 | `promoteDeployedCompanies` happy path, error isolation, correct DB query window, audit log content |

---

## 9. Deployment Notes

**Required manual steps before deploying:**

1. Run migration:
   ```bash
   cd backend && npx prisma migrate dev --name add_referral_stage
   ```
   After the schema DDL, append the backfill SQL from §3 to the generated migration file.

2. Run `npx prisma generate` to regenerate the Prisma client (resolves all TypeScript errors in `commission-detection.service.ts` and `cron.service.ts` caused by the new `referral_stage` field).

3. Schedule `GET /cron/promote-deployed-companies` to run **daily** in the external job scheduler.

4. The old `/revert-to-detected` endpoint is **removed**. Any caller must update to `/revert-to-pending`.

---

## 10. Verification Checklist

- [ ] `npx prisma migrate dev` runs without errors; backfill SQL promotes existing eligible/deployed companies
- [ ] `GET /med-alliance/admin/referred-companies` returns `referral_stage` and `hubspot_id` on each row
- [ ] `GET /med-alliance/admin/referred-companies/:id` returns `referral_stage`
- [ ] `PATCH /med-alliance/admin/referred-companies/:id/stage` with `{ "stage": "contacted" }` returns updated org + audit log entry
- [ ] `PATCH /med-alliance/admin/commissions/:id/revert-to-pending` works; old `/revert-to-detected` returns 404
- [ ] `PATCH /med-alliance/admin/commissions/:id/update-base-amount` works on both `detected` and `pending_admin_confirmation`
- [ ] `PATCH /med-alliance/admin/commissions/:id/unvoid` restores to `pending_admin_confirmation` when org is eligible, `detected` otherwise
- [ ] `GET /cron/promote-deployed-companies` returns `{ companiesPromoted, commissionsPromoted, errors }`
- [ ] First invoice sync on new referral: `referral_stage = deployed`, `med_alliance_referral_status = not_eligible`, commission `status = detected`
- [ ] First invoice sync on already-eligible company: commission `status = pending_admin_confirmation`
- [ ] Churned company: sync skips commission creation
- [ ] Affiliate list (`GET /med-alliance/referred-companies`) includes `referral_stage` on each row
