-- AlterTable
ALTER TABLE "PanelCandidate" ADD COLUMN     "createdByUserId" TEXT;

-- AddForeignKey
ALTER TABLE "PanelCandidate" ADD CONSTRAINT "PanelCandidate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;
