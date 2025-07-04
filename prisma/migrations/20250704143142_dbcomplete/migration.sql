/*
  Warnings:

  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('prospect', 'client', 'admin', 'super_admin');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('incomplete', 'active', 'inactive');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('available');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "ProficiencyLevel" AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');

-- CreateEnum
CREATE TYPE "SkillType" AS ENUM ('technical', 'soft', 'language', 'certification');

-- CreateEnum
CREATE TYPE "HireRequestStatus" AS ENUM ('pending_signature', 'new_request', 'in_progress', 'panel_ready', 'interview_scheduled', 'awaiting_decision', 'placement_complete', 'cancelled');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "PanelStatus" AS ENUM ('created', 'interview_scheduled', 'interview_completed', 'decision_pending', 'decision_made', 'expired');

-- CreateEnum
CREATE TYPE "PanelCandidateStatus" AS ENUM ('selected', 'interviewed', 'selected_by_client', 'returned_to_pool');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('scheduled', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('bonus_request', 'termination_request', 'general_support', 'technical_issue');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- DropForeignKey
ALTER TABLE "EmailVerification" DROP CONSTRAINT "EmailVerification_userId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- AlterTable
ALTER TABLE "EmailVerification" ALTER COLUMN "userId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Session" ALTER COLUMN "userId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "User_id_seq";

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "hubspot_id" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "address" TEXT,
    "contact_info" TEXT,
    "specialties" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "hubspot_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "pay_rate" DECIMAL(65,30),
    "resume_url" TEXT,
    "experience_years" INTEGER,
    "about_me" TEXT,
    "processed_resume_data" JSONB,
    "processing_status" "ProcessingStatus" NOT NULL DEFAULT 'pending',
    "processing_error" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateSkill" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "skill_name" TEXT NOT NULL,
    "proficiency_level" "ProficiencyLevel",
    "skill_type" "SkillType" NOT NULL DEFAULT 'technical',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateExperience" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "duration" TEXT,
    "responsibilities" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateEducation" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "year" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateEducation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HireRequest" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "requirements" TEXT,
    "status" "HireRequestStatus" NOT NULL DEFAULT 'new_request',
    "priority" "Priority" NOT NULL DEFAULT 'medium',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HireRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HireRequestSkill" (
    "id" TEXT NOT NULL,
    "hire_request_id" TEXT NOT NULL,
    "skill_name" TEXT NOT NULL,
    "required_level" "ProficiencyLevel" NOT NULL DEFAULT 'intermediate',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HireRequestSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidatePanel" (
    "id" TEXT NOT NULL,
    "hire_request_id" TEXT NOT NULL,
    "status" "PanelStatus" NOT NULL DEFAULT 'created',
    "scheduled_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidatePanel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PanelCandidate" (
    "id" TEXT NOT NULL,
    "panel_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "status" "PanelCandidateStatus" NOT NULL DEFAULT 'selected',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PanelCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL,
    "panel_id" TEXT NOT NULL,
    "scheduled_date" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL,
    "status" "InterviewStatus" NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "selected_candidate_id" TEXT,
    "decision_date" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "TicketType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_hubspot_id_key" ON "Organization"("hubspot_id");

-- CreateIndex
CREATE INDEX "idx_organizations_hubspot_id" ON "Organization"("hubspot_id");

-- CreateIndex
CREATE INDEX "idx_organizations_status" ON "Organization"("status");

-- CreateIndex
CREATE INDEX "idx_organizations_name" ON "Organization"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_hubspot_id_key" ON "Candidate"("hubspot_id");

-- CreateIndex
CREATE INDEX "idx_candidate_skills_candidate_id" ON "CandidateSkill"("candidate_id");

-- CreateIndex
CREATE INDEX "idx_candidate_skills_skill_name" ON "CandidateSkill"("skill_name");

-- CreateIndex
CREATE INDEX "idx_candidate_skills_skill_type" ON "CandidateSkill"("skill_type");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateSkill_candidate_id_skill_name_skill_type_key" ON "CandidateSkill"("candidate_id", "skill_name", "skill_type");

-- CreateIndex
CREATE INDEX "idx_candidate_experience_candidate_id" ON "CandidateExperience"("candidate_id");

-- CreateIndex
CREATE INDEX "idx_candidate_experience_company" ON "CandidateExperience"("company");

-- CreateIndex
CREATE INDEX "idx_candidate_experience_position" ON "CandidateExperience"("position");

-- CreateIndex
CREATE INDEX "idx_candidate_education_candidate_id" ON "CandidateEducation"("candidate_id");

-- CreateIndex
CREATE INDEX "idx_candidate_education_institution" ON "CandidateEducation"("institution");

-- CreateIndex
CREATE INDEX "idx_candidate_education_year" ON "CandidateEducation"("year");

-- CreateIndex
CREATE INDEX "idx_hire_requests_org_id" ON "HireRequest"("org_id");

-- CreateIndex
CREATE INDEX "idx_hire_requests_status" ON "HireRequest"("status");

-- CreateIndex
CREATE INDEX "idx_hire_requests_priority" ON "HireRequest"("priority");

-- CreateIndex
CREATE INDEX "idx_hire_requests_created_at" ON "HireRequest"("created_at");

-- CreateIndex
CREATE INDEX "idx_hire_request_skills_hire_request_id" ON "HireRequestSkill"("hire_request_id");

-- CreateIndex
CREATE INDEX "idx_hire_request_skills_skill_name" ON "HireRequestSkill"("skill_name");

-- CreateIndex
CREATE UNIQUE INDEX "HireRequestSkill_hire_request_id_skill_name_key" ON "HireRequestSkill"("hire_request_id", "skill_name");

-- CreateIndex
CREATE INDEX "idx_candidate_panels_hire_request_id" ON "CandidatePanel"("hire_request_id");

-- CreateIndex
CREATE INDEX "idx_candidate_panels_status" ON "CandidatePanel"("status");

-- CreateIndex
CREATE INDEX "idx_candidate_panels_scheduled_date" ON "CandidatePanel"("scheduled_date");

-- CreateIndex
CREATE INDEX "idx_panel_candidates_panel_id" ON "PanelCandidate"("panel_id");

-- CreateIndex
CREATE INDEX "idx_panel_candidates_candidate_id" ON "PanelCandidate"("candidate_id");

-- CreateIndex
CREATE INDEX "idx_panel_candidates_status" ON "PanelCandidate"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PanelCandidate_panel_id_candidate_id_key" ON "PanelCandidate"("panel_id", "candidate_id");

-- CreateIndex
CREATE INDEX "idx_interviews_panel_id" ON "Interview"("panel_id");

-- CreateIndex
CREATE INDEX "idx_interviews_scheduled_date" ON "Interview"("scheduled_date");

-- CreateIndex
CREATE INDEX "idx_interviews_status" ON "Interview"("status");

-- CreateIndex
CREATE INDEX "idx_interviews_selected_candidate_id" ON "Interview"("selected_candidate_id");

-- CreateIndex
CREATE INDEX "idx_interviews_expires_at" ON "Interview"("expires_at");

-- CreateIndex
CREATE INDEX "idx_tickets_user_id" ON "Ticket"("user_id");

-- CreateIndex
CREATE INDEX "idx_tickets_type" ON "Ticket"("type");

-- CreateIndex
CREATE INDEX "idx_tickets_status" ON "Ticket"("status");

-- CreateIndex
CREATE INDEX "idx_tickets_created_at" ON "Ticket"("created_at");

-- CreateIndex
CREATE INDEX "idx_users_email" ON "User"("email");

-- CreateIndex
CREATE INDEX "idx_users_role" ON "User"("role");

-- CreateIndex
CREATE INDEX "idx_users_organization_id" ON "User"("organizationId");

-- CreateIndex
CREATE INDEX "idx_users_status" ON "User"("status");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerification" ADD CONSTRAINT "EmailVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSkill" ADD CONSTRAINT "CandidateSkill_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateExperience" ADD CONSTRAINT "CandidateExperience_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateEducation" ADD CONSTRAINT "CandidateEducation_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HireRequest" ADD CONSTRAINT "HireRequest_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HireRequestSkill" ADD CONSTRAINT "HireRequestSkill_hire_request_id_fkey" FOREIGN KEY ("hire_request_id") REFERENCES "HireRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidatePanel" ADD CONSTRAINT "CandidatePanel_hire_request_id_fkey" FOREIGN KEY ("hire_request_id") REFERENCES "HireRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanelCandidate" ADD CONSTRAINT "PanelCandidate_panel_id_fkey" FOREIGN KEY ("panel_id") REFERENCES "CandidatePanel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanelCandidate" ADD CONSTRAINT "PanelCandidate_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_panel_id_fkey" FOREIGN KEY ("panel_id") REFERENCES "CandidatePanel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_selected_candidate_id_fkey" FOREIGN KEY ("selected_candidate_id") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
