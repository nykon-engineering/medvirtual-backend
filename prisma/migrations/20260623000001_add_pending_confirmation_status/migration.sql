-- AlterEnum: add pending_confirmation to MedAllianceReferralStatus
-- This is a safe, additive change — existing rows are unaffected.
ALTER TYPE "MedAllianceReferralStatus" ADD VALUE IF NOT EXISTS 'pending_confirmation';
