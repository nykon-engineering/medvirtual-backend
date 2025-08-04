/*
  Warnings:

  - The values [processing] on the enum `ProcessingStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ProcessingStatus_new" AS ENUM ('pending', 'processing_downloadFile', 'processing_uploadFile', 'processing_extractData', 'processing_extractText', 'processing_organizeData', 'processing_updateCandidate', 'completed', 'failed');
ALTER TABLE "Candidate" ALTER COLUMN "processing_status" DROP DEFAULT;
ALTER TABLE "Candidate" ALTER COLUMN "processing_status" TYPE "ProcessingStatus_new" USING ("processing_status"::text::"ProcessingStatus_new");
ALTER TYPE "ProcessingStatus" RENAME TO "ProcessingStatus_old";
ALTER TYPE "ProcessingStatus_new" RENAME TO "ProcessingStatus";
DROP TYPE "ProcessingStatus_old";
ALTER TABLE "Candidate" ALTER COLUMN "processing_status" SET DEFAULT 'pending';
COMMIT;
