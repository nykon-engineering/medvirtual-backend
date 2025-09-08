-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "candidate_id" TEXT;

-- CreateIndex
CREATE INDEX "idx_tickets_candidate_id" ON "Ticket"("candidate_id");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
