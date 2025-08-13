/*
  Warnings:

  - The values [created,interview_completed,decision_pending,decision_made,expired] on the enum `PanelStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PanelStatus_new" AS ENUM ('new', 'sourcing', 'panel_ready', 'interview_scheduled', 'awaiting_decision', 'placement_completed', 'canceled');
ALTER TABLE "CandidatePanel" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "CandidatePanel" ALTER COLUMN "status" TYPE "PanelStatus_new" USING ("status"::text::"PanelStatus_new");
ALTER TYPE "PanelStatus" RENAME TO "PanelStatus_old";
ALTER TYPE "PanelStatus_new" RENAME TO "PanelStatus";
DROP TYPE "PanelStatus_old";
ALTER TABLE "CandidatePanel" ALTER COLUMN "status" SET DEFAULT 'new';
COMMIT;

-- AlterTable
ALTER TABLE "CandidatePanel" ADD COLUMN     "readable" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "status" SET DEFAULT 'new';
