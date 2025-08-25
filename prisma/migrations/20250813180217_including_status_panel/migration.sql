/*
  Warnings:

  - The values [new_request,in_progress,placement_complete] on the enum `HireRequestStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [new,sourcing,panel_ready,awaiting_decision,placement_completed,canceled,pending_signature] on the enum `PanelStatus` will be removed. If these variants are still used in the database, this will fail.

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

-- AlterEnum
BEGIN;
CREATE TYPE "PanelStatus_new" AS ENUM ('created', 'interview_scheduled', 'interview_completed', 'decision_pending', 'decision_made', 'expired');
ALTER TABLE "CandidatePanel" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "CandidatePanel" ALTER COLUMN "status" TYPE "PanelStatus_new" USING ("status"::text::"PanelStatus_new");
ALTER TYPE "PanelStatus" RENAME TO "PanelStatus_old";
ALTER TYPE "PanelStatus_new" RENAME TO "PanelStatus";
DROP TYPE "PanelStatus_old";
ALTER TABLE "CandidatePanel" ALTER COLUMN "status" SET DEFAULT 'created';
COMMIT;

-- AlterTable
ALTER TABLE "CandidatePanel" ALTER COLUMN "status" SET DEFAULT 'created';

-- AlterTable
ALTER TABLE "HireRequest" ALTER COLUMN "status" SET DEFAULT 'new';
