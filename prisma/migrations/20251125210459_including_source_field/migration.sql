-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "source" TEXT;

-- CreateIndex
CREATE INDEX "idx_talent_pool_leads_assigned_to_user_id" ON "TalentPoolLead"("assigned_to_user_id");

-- CreateIndex
CREATE INDEX "idx_talent_pool_leads_email" ON "TalentPoolLead"("email");

-- CreateIndex
CREATE INDEX "idx_talent_pool_leads_status" ON "TalentPoolLead"("status");

-- CreateIndex
CREATE INDEX "idx_talent_pool_leads_source" ON "TalentPoolLead"("source");

-- CreateIndex
CREATE INDEX "idx_tickets_created_by" ON "Ticket"("created_by");

-- AddForeignKey
ALTER TABLE "TalentPoolLead" ADD CONSTRAINT "TalentPoolLead_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;
