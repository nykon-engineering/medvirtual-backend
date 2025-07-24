/*
  Warnings:

  - You are about to drop the column `created_at` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `experience_years` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `pay_rate` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `CandidateEducation` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `CandidateExperience` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `CandidatePanel` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `CandidateSkill` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `HireRequest` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `HireRequestSkill` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `Interview` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `PanelCandidate` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `Ticket` table. All the data in the column will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "EmailInvitation" DROP CONSTRAINT "EmailInvitation_userId_fkey";

-- DropForeignKey
ALTER TABLE "EmailVerification" DROP CONSTRAINT "EmailVerification_userId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_user_id_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_organizationId_fkey";

-- DropIndex
DROP INDEX "idx_hire_requests_created_at";

-- DropIndex
DROP INDEX "idx_tickets_created_at";

-- AlterTable
ALTER TABLE "Candidate" DROP COLUMN "created_at",
DROP COLUMN "experience_years",
DROP COLUMN "pay_rate",
DROP COLUMN "status",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "hourly_pay_rate" DECIMAL(65,30),
ADD COLUMN     "organization_id" TEXT,
ADD COLUMN     "pipeline_status" TEXT NOT NULL DEFAULT 'available',
ADD COLUMN     "years_of_experience" INTEGER;

-- AlterTable
ALTER TABLE "CandidateEducation" DROP COLUMN "created_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "CandidateExperience" DROP COLUMN "created_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "CandidatePanel" DROP COLUMN "created_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "CandidateSkill" DROP COLUMN "created_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "HireRequest" DROP COLUMN "created_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "HireRequestSkill" DROP COLUMN "created_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Interview" DROP COLUMN "created_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Organization" DROP COLUMN "created_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "PanelCandidate" DROP COLUMN "created_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Ticket" DROP COLUMN "created_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "User";

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

    CONSTRAINT "USER_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ORGANIZATION_CANDIDATE" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "pipelineStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ORGANIZATION_CANDIDATE_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "ORGANIZATION_CANDIDATE_organization_id_candidate_id_key" ON "ORGANIZATION_CANDIDATE"("organization_id", "candidate_id");

-- CreateIndex
CREATE INDEX "idx_hire_requests_createdAt" ON "HireRequest"("createdAt");

-- CreateIndex
CREATE INDEX "idx_tickets_createdAt" ON "Ticket"("createdAt");

-- AddForeignKey
ALTER TABLE "USER" ADD CONSTRAINT "USER_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerification" ADD CONSTRAINT "EmailVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailInvitation" ADD CONSTRAINT "EmailInvitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ORGANIZATION_CANDIDATE" ADD CONSTRAINT "ORGANIZATION_CANDIDATE_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ORGANIZATION_CANDIDATE" ADD CONSTRAINT "ORGANIZATION_CANDIDATE_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
