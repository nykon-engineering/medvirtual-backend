-- AlterEnum
ALTER TYPE "PanelStatus" ADD VALUE 'pending_signature';

-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "gender" TEXT;
