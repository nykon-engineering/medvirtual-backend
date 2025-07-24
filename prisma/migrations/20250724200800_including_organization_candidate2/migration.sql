/*
  Warnings:

  - You are about to drop the `ORGANIZATION_CANDIDATE` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ORGANIZATION_CANDIDATE" DROP CONSTRAINT "ORGANIZATION_CANDIDATE_candidate_id_fkey";

-- DropForeignKey
ALTER TABLE "ORGANIZATION_CANDIDATE" DROP CONSTRAINT "ORGANIZATION_CANDIDATE_organization_id_fkey";

-- DropTable
DROP TABLE "ORGANIZATION_CANDIDATE";

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

-- AddForeignKey
ALTER TABLE "OrganizationCandidate" ADD CONSTRAINT "OrganizationCandidate_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationCandidate" ADD CONSTRAINT "OrganizationCandidate_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
