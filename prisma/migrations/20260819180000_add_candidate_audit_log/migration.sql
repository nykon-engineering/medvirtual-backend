-- CreateEnum
CREATE TYPE "CandidateAuditFieldGroup" AS ENUM ('pipeline_status', 'processing', 'profile', 'business_unit', 'va_scorecard', 'hubspot_sync', 'lifecycle');

-- CreateEnum
CREATE TYPE "CandidateAuditSource" AS ENUM ('user', 'system', 'cron', 'webhook');

-- CreateTable
CREATE TABLE "CandidateAuditLog" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "hubspot_id" TEXT,
    "actor_user_id" TEXT,
    "actor_label" TEXT,
    "event" TEXT NOT NULL,
    "field_group" "CandidateAuditFieldGroup" NOT NULL,
    "pipeline_status_new" TEXT,
    "source" "CandidateAuditSource" NOT NULL DEFAULT 'system',
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_candidate_audit_timeline" ON "CandidateAuditLog"("candidate_id", "createdAt");

-- CreateIndex
CREATE INDEX "idx_candidate_audit_event_created_at" ON "CandidateAuditLog"("event", "createdAt");

-- CreateIndex
CREATE INDEX "idx_candidate_audit_field_group" ON "CandidateAuditLog"("field_group", "createdAt");

-- CreateIndex
CREATE INDEX "idx_candidate_audit_actor" ON "CandidateAuditLog"("actor_user_id");

-- CreateIndex
CREATE INDEX "idx_candidate_audit_created_at" ON "CandidateAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "CandidateAuditLog" ADD CONSTRAINT "CandidateAuditLog_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;
