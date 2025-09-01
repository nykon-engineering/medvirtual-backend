-- CreateEnum
CREATE TYPE "Role" AS ENUM ('organization_admin', 'organization_super_admin', 'system_admin', 'system_super_admin');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('incomplete', 'active', 'inactive', 'deleted', 'prospect', 'pending_verification', 'suspended');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('available');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('pending', 'processing_downloadFile', 'processing_uploadFile', 'processing_extractData', 'processing_extractText', 'processing_organizeData', 'processing_updateCandidate', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "ProficiencyLevel" AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');

-- CreateEnum
CREATE TYPE "SkillType" AS ENUM ('technical', 'soft', 'language', 'certification');

-- CreateEnum
CREATE TYPE "HireRequestStatus" AS ENUM ('new', 'pending_signature', 'sourcing', 'panel_ready', 'interview_scheduled', 'awaiting_decision', 'placement_completed', 'cancelled');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "PanelStatus" AS ENUM ('created', 'interview_scheduled', 'interview_completed', 'decision_pending', 'decision_made', 'expired');

-- CreateEnum
CREATE TYPE "PanelCandidateStatus" AS ENUM ('selected', 'interviewed', 'selected_by_client', 'returned_to_pool');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('scheduled', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('new', 'in_progress', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('prospect', 'client', 'admin', 'super_admin');

-- CreateTable
CREATE TABLE "USER" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organization_id" TEXT,
    "organization_name" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "job_title" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "workos_id" TEXT NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "authentication_method" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assigned_system_admin" TEXT,
    "client_activated_at" TIMESTAMP(3),
    "document_signed_at" TIMESTAMP(3),
    "is_organization_owner" BOOLEAN NOT NULL DEFAULT false,
    "panda_doc_signed_url" TEXT,
    "prospect_created_at" TIMESTAMP(3),
    "userRole" "UserRole" NOT NULL DEFAULT 'prospect',

    CONSTRAINT "USER_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EmailVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailInvitation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "email_from" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EmailInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "type" TEXT,
    "hubspot_id" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "address" TEXT,
    "contact_info" TEXT,
    "specialties" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "admin_id" TEXT DEFAULT '',
    "description" TEXT,
    "owner_id" TEXT,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "hubspot_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "resume_url" TEXT,
    "about_me" TEXT,
    "processed_resume_data" JSONB,
    "processing_status" "ProcessingStatus" NOT NULL DEFAULT 'pending',
    "processing_error" TEXT,
    "processed_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hourly_pay_rate" DECIMAL(65,30),
    "organization_id" TEXT,
    "pipeline_status" TEXT NOT NULL DEFAULT 'available',
    "years_of_experience" INTEGER,
    "country" TEXT,
    "specialization" TEXT,
    "employment_type" TEXT,
    "name" TEXT,
    "medical_tools" TEXT,
    "tools" TEXT,
    "gender" TEXT,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateLanguage" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateLanguage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationCandidate" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "pipeline_status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateSkill" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "skill_name" TEXT NOT NULL,
    "proficiency_level" "ProficiencyLevel",
    "skill_type" "SkillType" NOT NULL DEFAULT 'technical',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateExperience" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responsabilities" TEXT,
    "end_date" TIMESTAMP(3),
    "start_date" TIMESTAMP(3),

    CONSTRAINT "CandidateExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateEducation" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "year" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateEducation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HireRequest" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "HireRequestStatus" NOT NULL DEFAULT 'new',
    "priority" "Priority" NOT NULL DEFAULT 'medium',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "availability" TEXT NOT NULL,
    "contract_length" TEXT,
    "expected_start_date" TIMESTAMP(3),
    "salary_range_from" DECIMAL(65,30),
    "salary_range_to" DECIMAL(65,30),
    "specialization" TEXT NOT NULL,
    "location" TEXT,
    "assign_user_id" TEXT,

    CONSTRAINT "HireRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HireRequestSkill" (
    "id" TEXT NOT NULL,
    "hire_request_id" TEXT NOT NULL,
    "skill_name" TEXT NOT NULL,
    "required_level" "ProficiencyLevel" NOT NULL DEFAULT 'intermediate',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HireRequestSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidatePanel" (
    "id" TEXT NOT NULL,
    "hire_request_id" TEXT NOT NULL,
    "status" "PanelStatus" NOT NULL DEFAULT 'created',
    "scheduled_date" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readable" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CandidatePanel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PanelCandidate" (
    "id" TEXT NOT NULL,
    "panel_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "status" "PanelCandidateStatus" NOT NULL DEFAULT 'selected',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "priority" "Priority" NOT NULL,
    "staff_id" TEXT,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleToken" (
    "id" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "scope" TEXT,
    "tokenType" TEXT,
    "expiryDate" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "hirerequest_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "salary" DECIMAL(65,30),
    "start_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "terminated_date" TIMESTAMP(3),

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bonus" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "Bonus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "USER_email_key" ON "USER"("email");

-- CreateIndex
CREATE INDEX "idx_users_email" ON "USER"("email");

-- CreateIndex
CREATE INDEX "idx_users_role" ON "USER"("role");

-- CreateIndex
CREATE INDEX "idx_users_organization_id" ON "USER"("organization_id");

-- CreateIndex
CREATE INDEX "idx_users_status" ON "USER"("status");

-- CreateIndex
CREATE INDEX "idx_users_assigned_system_admin" ON "USER"("assigned_system_admin");

-- CreateIndex
CREATE INDEX "idx_users_is_organization_owner" ON "USER"("is_organization_owner");

-- CreateIndex
CREATE INDEX "idx_users_userRole" ON "USER"("userRole");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_email_key" ON "Organization"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_hubspot_id_key" ON "Organization"("hubspot_id");

-- CreateIndex
CREATE INDEX "idx_organizations_hubspot_id" ON "Organization"("hubspot_id");

-- CreateIndex
CREATE INDEX "idx_organizations_status" ON "Organization"("status");

-- CreateIndex
CREATE INDEX "idx_organizations_name" ON "Organization"("name");

-- CreateIndex
CREATE INDEX "idx_organizations_admin_id" ON "Organization"("admin_id");

-- CreateIndex
CREATE INDEX "idx_organizations_owner_id" ON "Organization"("owner_id");

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
CREATE INDEX "idx_hire_requests_createdAt" ON "HireRequest"("createdAt");

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
CREATE INDEX "idx_tickets_createdAt" ON "Ticket"("createdAt");

-- CreateIndex
CREATE INDEX "idx_staff_candidate_id" ON "Staff"("candidate_id");

-- CreateIndex
CREATE INDEX "idx_staff_hirerequest_id" ON "Staff"("hirerequest_id");

-- CreateIndex
CREATE INDEX "idx_staff_status" ON "Staff"("status");

-- CreateIndex
CREATE INDEX "idx_bonus_staff_id" ON "Bonus"("staff_id");

-- AddForeignKey
ALTER TABLE "USER" ADD CONSTRAINT "USER_assigned_system_admin_fkey" FOREIGN KEY ("assigned_system_admin") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "USER" ADD CONSTRAINT "USER_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerification" ADD CONSTRAINT "EmailVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailInvitation" ADD CONSTRAINT "EmailInvitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateLanguage" ADD CONSTRAINT "CandidateLanguage_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationCandidate" ADD CONSTRAINT "OrganizationCandidate_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationCandidate" ADD CONSTRAINT "OrganizationCandidate_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSkill" ADD CONSTRAINT "CandidateSkill_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateExperience" ADD CONSTRAINT "CandidateExperience_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateEducation" ADD CONSTRAINT "CandidateEducation_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HireRequest" ADD CONSTRAINT "HireRequest_assign_user_id_fkey" FOREIGN KEY ("assign_user_id") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HireRequest" ADD CONSTRAINT "HireRequest_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HireRequestSkill" ADD CONSTRAINT "HireRequestSkill_hire_request_id_fkey" FOREIGN KEY ("hire_request_id") REFERENCES "HireRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidatePanel" ADD CONSTRAINT "CandidatePanel_hire_request_id_fkey" FOREIGN KEY ("hire_request_id") REFERENCES "HireRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanelCandidate" ADD CONSTRAINT "PanelCandidate_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanelCandidate" ADD CONSTRAINT "PanelCandidate_panel_id_fkey" FOREIGN KEY ("panel_id") REFERENCES "CandidatePanel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_panel_id_fkey" FOREIGN KEY ("panel_id") REFERENCES "CandidatePanel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_selected_candidate_id_fkey" FOREIGN KEY ("selected_candidate_id") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_hirerequest_id_fkey" FOREIGN KEY ("hirerequest_id") REFERENCES "HireRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bonus" ADD CONSTRAINT "Bonus_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

