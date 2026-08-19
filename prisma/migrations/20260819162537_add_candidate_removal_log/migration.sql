-- CreateEnum
CREATE TYPE "CandidateRemovalReason" AS ENUM ('deleted', 'lost');

-- CreateTable
CREATE TABLE "CandidateRemovalLog" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "hubspot_id" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "reason" "CandidateRemovalReason" NOT NULL,
    "removed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateRemovalLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_candidate_removal_reason_removed_at" ON "CandidateRemovalLog"("reason", "removed_at");

-- CreateIndex
CREATE INDEX "idx_candidate_removal_hubspot_id" ON "CandidateRemovalLog"("hubspot_id");

-- CreateIndex
CREATE INDEX "idx_candidate_removal_candidate_id" ON "CandidateRemovalLog"("candidate_id");
