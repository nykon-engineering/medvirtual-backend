# Referred Company Data Access Policy

Affiliate-scoped reads of a referred company (an `Organization` with `referred_by_affiliate_id` set) return a deliberately narrower field set than the admin-scoped reads. This exists so an affiliate never sees internal-only fields (HubSpot sync diagnostics, other affiliates' commission data, admin notes, block reasons) about a company they referred.

**Enforced in:** `src/med-alliance/referred-companies/referred-companies.service.ts`, methods `findAllForAffiliate` and `findOneForAffiliate`. Both use an explicit Prisma `select` — never a blanket `include` — so adding a new `Organization` field never leaks to the affiliate-facing API by default.

## Allowed fields (affiliate-scoped)

- `id`, `name`, `email`, `phone`, `status`
- `industry`, `business_unit` (list only), `location`, `address`, `city`, `state`, `description`, `website_url`
- `createdAt`
- `contact_first_name`, `contact_last_name`, `contact_email` (list only)
- `med_alliance_referral_status`, `eligibility_start_at`, `referral_stage`
- `referToUser` (id, first_name, last_name only)
- `affiliateCommissions` — filtered to `affiliate_id: currentUser.id` only, and only `commission_amount`/`status` are selected; the raw array is stripped before the response is returned and replaced with computed aggregates (`my_commissions`, `commission_status`)

## Explicitly excluded from affiliate-scoped reads

- `med_alliance_block_reason`, `med_alliance_approval_note` — internal admin-only context for why a company was blocked or approved
- `deployment_date`, `first_paid_invoice_at` — shown to admins (`findOneForAdmin`) but not affiliates
- `hubspot_id`, `hubspot_sync_status`, `hubspot_sync_error`, `hubspot_synced_at` — internal sync diagnostics
- `referral_submission_snapshot` — admin-only audit snapshot of the original referral form
- `hubspotInvoiceSnapshots`, `adminReviewCases` — admin-only
- Any other affiliate's `affiliateCommissions` rows for the same organization

## When adding a new field to `Organization`

Default to **not** exposing it to affiliates. Only add it to the affiliate-scoped `select` blocks above if it is something the referring affiliate is meant to see about their own referral — and update this document alongside the code change.
