-- AlterTable: add admin approval note for manual eligibility overrides
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "med_alliance_approval_note" TEXT;
