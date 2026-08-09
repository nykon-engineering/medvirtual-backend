-- AlterTable
ALTER TABLE "BusinessUnit"
  ADD COLUMN     "is_visible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN     "hubspot_value" TEXT,
  ADD COLUMN     "candidate_pool" TEXT NOT NULL DEFAULT 'medical',
  ADD COLUMN     "primary_color" TEXT,
  ADD COLUMN     "primary_hover" TEXT,
  ADD COLUMN     "logo_url" TEXT,
  ADD COLUMN     "favicon_url" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BusinessUnit_hubspot_value_key" ON "BusinessUnit"("hubspot_value");

-- CreateIndex
CREATE INDEX "idx_business_units_is_visible" ON "BusinessUnit"("is_visible");

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "deactivated_by_bu" TEXT;

-- CreateIndex
CREATE INDEX "idx_organizations_deactivated_by_bu" ON "Organization"("deactivated_by_bu");

-- AlterTable
ALTER TABLE "USER" ADD COLUMN     "deactivated_by_bu" TEXT;

-- CreateIndex
CREATE INDEX "idx_users_deactivated_by_bu" ON "USER"("deactivated_by_bu");

-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "deactivated_by_bu" TEXT;

-- CreateIndex
CREATE INDEX "idx_candidates_deactivated_by_bu" ON "Candidate"("deactivated_by_bu");

-- AlterTable
ALTER TABLE "AffiliateProfile" ADD COLUMN     "deactivated_by_bu" TEXT;

-- CreateIndex
CREATE INDEX "idx_affiliate_profiles_deactivated_by_bu" ON "AffiliateProfile"("deactivated_by_bu");
