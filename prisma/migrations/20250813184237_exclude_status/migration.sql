/*
  Warnings:

  - The values [expired] on the enum `HireRequestStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "HireRequestStatus_new" AS ENUM ('new', 'pending_signature', 'sourcing', 'panel_ready', 'interview_scheduled', 'awaiting_decision', 'placement_completed', 'cancelled');
ALTER TABLE "HireRequest" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "HireRequest" ALTER COLUMN "status" TYPE "HireRequestStatus_new" USING ("status"::text::"HireRequestStatus_new");
ALTER TYPE "HireRequestStatus" RENAME TO "HireRequestStatus_old";
ALTER TYPE "HireRequestStatus_new" RENAME TO "HireRequestStatus";
DROP TYPE "HireRequestStatus_old";
ALTER TABLE "HireRequest" ALTER COLUMN "status" SET DEFAULT 'new';
COMMIT;
