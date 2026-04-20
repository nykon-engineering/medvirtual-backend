# Med Alliance — Commission Eligibility Spec

## Overview

**Eligibility** controls whether paid invoices from a referred company can generate commissions for the affiliate who referred it.

- `eligible` — invoices from this company generate commissions normally.
- `not_eligible` — no commissions are created from invoices. This is the default state and is also applied when eligibility expires or when a permanent block is in place.

The flag is stored on `Organization.med_alliance_referral_status` and is always `eligible | not_eligible` (binary). No other values exist.

---

## Fields

| Field | Type | Description |
|---|---|---|
| `med_alliance_referral_status` | `MedAllianceReferralStatus?` | Current eligibility: `eligible` or `not_eligible` |
| `med_alliance_block_reason` | `String?` | Human-readable reason for `not_eligible`. Prefix `active_client_block:` = permanent block; `eligibility_expired:` = window elapsed. |
| `eligibility_start_at` | `DateTime?` | Anchor for the one-year window. Set when the first paid invoice is received. Cleared when the window expires. |
| `first_paid_invoice_at` | `DateTime?` | Date of the first qualifying paid invoice. **Never cleared** — used as a permanent audit record and to prevent re-activation after expiry. |

---

## Eligibility Lifecycle — Truth Table

| State / Event | `med_alliance_referral_status` | `eligibility_start_at` | `first_paid_invoice_at` | `block_reason` |
|---|---|---|---|---|
| Company referred (initial) | `not_eligible` | `null` | `null` | `null` |
| Active MedVirtual client match found | `not_eligible` | `null` | `null` | `active_client_block: …` |
| Multiple HubSpot matches (pending admin review) | `not_eligible` | `null` | `null` | `null` |
| First paid invoice received | `eligible` | set to invoice date | set to invoice date | `null` |
| Subsequent paid invoices (within 1-year window) | `eligible` | unchanged | unchanged | `null` |
| One year elapsed from `eligibility_start_at` (detected on next invoice) | `not_eligible` | cleared (`null`) | preserved | `eligibility_expired: …` |
| Referral older than 1 year with no first paid invoice | `not_eligible` (skip, no write) | `null` | `null` | `null` |

---

## Enforcement Points

### 1. Invoice receipt → `CommissionDetectionService.run()`

Called during every sync cycle. Executes the full eligibility lifecycle:

1. **Permanent block** — if `block_reason` starts with `active_client_block`, skip. No commissions.
2. **Expiry check** — if status is `eligible` and `eligibility_start_at + 1 year < now()`, transition to `not_eligible`, clear `eligibility_start_at`, log to audit. Skip commissions.
3. **Referral-age rule** — if `not_eligible`, `first_paid_invoice_at == null`, and `createdAt + 1 year < now()`, skip. Referral is too old to ever activate.
4. **Window expired** — if `not_eligible` and `first_paid_invoice_at != null`, the window already expired in a prior run. Skip.
5. **First qualifying event** — if `not_eligible` and `first_paid_invoice_at == null` and paid invoices exist, transition to `eligible`, set `eligibility_start_at` and `first_paid_invoice_at`, log to audit.
6. **Normal flow** — if `eligible`, create commissions for all qualifying paid snapshots (idempotent via `idempotency_key`).

### 2. Commission approval → `CommissionsService.decide()`

When an admin approves a commission (sets status to `eligible`), the service re-checks the organization's current status. If `not_eligible`, the approval is rejected with a `BadRequestException`.

### 3. Read-time computation → `ReferredCompaniesService`

All list and detail endpoints compute the **effective** status before returning:

```typescript
function computeEffectiveStatus(stored, eligibilityStartAt) {
  if (stored !== 'eligible' || !eligibilityStartAt) return stored;
  if (Date.now() - eligibilityStartAt.getTime() > ONE_YEAR_MS) return 'not_eligible';
  return 'eligible';
}
```

This ensures the UI always reflects reality even if a company's window has elapsed but no new invoice has arrived yet to trigger the DB update.

---

## Architecture Decision: Event-Driven vs. Cron

**Chosen approach**: Expiry is evaluated **on every paid invoice event** (event-driven), not via a daily cron job.

**Why**:
- Simpler infrastructure — no `@nestjs/schedule` dependency.
- Expiry check fires exactly when it matters: at commission-creation time.
- Cleaner separation: `CommissionDetectionService` is the single source of truth for eligibility transitions.

**Trade-off**: If a company stops receiving invoices after its window expires, the stored `med_alliance_referral_status` in the DB will remain `eligible` until the next invoice arrives. This is mitigated by the **read-time computation** in the listing/detail endpoints, which always returns the correct effective status to the UI.

---

## Active-Client Block vs. Eligibility

These are independent mechanisms:

| | Active-Client Block | Eligibility Window |
|---|---|---|
| Trigger | `EligibilityCheckService` — checks if company is already a MedVirtual client | `CommissionDetectionService` — invoice-driven |
| Stored in | `med_alliance_block_reason` (`active_client_block: …`) | `med_alliance_referral_status` + `eligibility_start_at` |
| Reversible? | Yes — if company is no longer an active client and admin re-runs the check | No — once expired (`first_paid_invoice_at` is set + window elapsed), no re-activation |
| Effect | Permanent skip in commission pipeline | Skip until first invoice (then eligible for 1 year) |

---

## Frontend

The affiliate UI and admin UI both display only **"Eligible"** or **"Not eligible"** — sourced from `med_alliance_referral_status` as returned by the API (which applies read-time computation). No other labels exist for this column.

Relevant files:
- `src/app/med-alliance/referred-companies/types.ts` — `ReferralStatus` type
- `src/app/med-alliance/referred-companies/page.tsx` — `ReferralStatusBadge`
- `src/app/med-alliance/companies/page.tsx` — admin companies list badge
- `src/components/affiliate-side-profile.tsx` — side panel badge
