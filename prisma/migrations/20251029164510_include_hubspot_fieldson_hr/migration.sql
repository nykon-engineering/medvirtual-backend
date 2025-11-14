-- AlterTable
ALTER TABLE "HireRequest" ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "hubspot_contract_amount" DECIMAL(65,30),
ADD COLUMN     "hubspot_language" TEXT,
ADD COLUMN     "hubspot_numberVA" INTEGER,
ADD COLUMN     "hubspot_role_type" TEXT;

-- CreateIndex
CREATE INDEX "idx_hire_requests_created_by_user_id" ON "HireRequest"("createdByUserId");

-- AddForeignKey
ALTER TABLE "HireRequest" ADD CONSTRAINT "HireRequest_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;
