-- Backfill: move organizations that were expired under the old encoding
-- (med_alliance_referral_status = 'not_eligible' with a med_alliance_block_reason
-- prefixed 'eligibility_expired:') into the new, explicit 'expired' status.
-- This targets rows written by the old expireEligibility()/promoteDeployedCompanies()
-- logic across commission-detection.service.ts, commissions.service.ts, and
-- affiliates.service.ts, all of which wrote the same reason-string prefix.
UPDATE "Organization"
SET "med_alliance_referral_status" = 'expired',
    "med_alliance_block_reason" = NULL
WHERE "med_alliance_referral_status" = 'not_eligible'
  AND "med_alliance_block_reason" LIKE 'eligibility_expired:%';
