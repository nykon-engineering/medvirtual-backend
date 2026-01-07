-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "hireRequest_id" TEXT;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_hireRequest_id_fkey" FOREIGN KEY ("hireRequest_id") REFERENCES "HireRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
