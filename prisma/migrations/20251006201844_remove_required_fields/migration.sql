-- DropForeignKey
ALTER TABLE "Staff" DROP CONSTRAINT "Staff_candidate_id_fkey";

-- DropForeignKey
ALTER TABLE "Staff" DROP CONSTRAINT "Staff_hirerequest_id_fkey";

-- AlterTable
ALTER TABLE "Staff" ALTER COLUMN "candidate_id" DROP NOT NULL,
ALTER COLUMN "hirerequest_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_hirerequest_id_fkey" FOREIGN KEY ("hirerequest_id") REFERENCES "HireRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
