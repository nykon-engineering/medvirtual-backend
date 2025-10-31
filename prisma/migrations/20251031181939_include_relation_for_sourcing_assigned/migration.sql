-- AlterTable
ALTER TABLE "HireRequest" ADD COLUMN     "assign_sourcing_id" TEXT;

-- AddForeignKey
ALTER TABLE "HireRequest" ADD CONSTRAINT "HireRequest_assign_sourcing_id_fkey" FOREIGN KEY ("assign_sourcing_id") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;
