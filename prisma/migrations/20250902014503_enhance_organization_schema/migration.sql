/*
  Warnings:

  - You are about to drop the column `address` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `contact_info` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Organization` table. All the data in the column will be lost.
  - The `status` column on the `Organization` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `specialties` column on the `Organization` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `assigned_system_admin` on the `USER` table. All the data in the column will be lost.
  - You are about to drop the column `client_activated_at` on the `USER` table. All the data in the column will be lost.
  - You are about to drop the column `document_signed_at` on the `USER` table. All the data in the column will be lost.
  - You are about to drop the column `panda_doc_signed_url` on the `USER` table. All the data in the column will be lost.
  - You are about to drop the column `prospect_created_at` on the `USER` table. All the data in the column will be lost.
  - You are about to drop the column `userRole` on the `USER` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[owner_id]` on the table `Organization` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Organization` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('prospect', 'client');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('active', 'inactive');

-- DropForeignKey
ALTER TABLE "USER" DROP CONSTRAINT "USER_assigned_system_admin_fkey";

-- DropIndex
DROP INDEX "idx_users_assigned_system_admin";

-- DropIndex
DROP INDEX "idx_users_userRole";

-- AlterTable
ALTER TABLE "Organization" DROP COLUMN "address",
DROP COLUMN "contact_info",
DROP COLUMN "type",
ADD COLUMN     "concierge_id" TEXT,
ADD COLUMN     "date_became_client" TIMESTAMP(3),
ADD COLUMN     "date_founded" TIMESTAMP(3),
ADD COLUMN     "date_joined" TIMESTAMP(3),
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "number_of_employees" INTEGER,
ADD COLUMN     "organization_role" "OrganizationRole" NOT NULL DEFAULT 'prospect',
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "services" TEXT[],
ADD COLUMN     "signed_document_date" TIMESTAMP(3),
ADD COLUMN     "signed_document_url" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3),
ADD COLUMN     "website_url" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "OrganizationStatus" NOT NULL DEFAULT 'active',
DROP COLUMN "specialties",
ADD COLUMN     "specialties" TEXT[];

-- Update existing records to set updatedAt to current timestamp
UPDATE "Organization" SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL;

-- Make updatedAt required
ALTER TABLE "Organization" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "USER" DROP COLUMN "assigned_system_admin",
DROP COLUMN "client_activated_at",
DROP COLUMN "document_signed_at",
DROP COLUMN "panda_doc_signed_url",
DROP COLUMN "prospect_created_at",
DROP COLUMN "userRole";

-- DropEnum
DROP TYPE "UserRole";

-- CreateIndex
CREATE UNIQUE INDEX "Organization_owner_id_key" ON "Organization"("owner_id");

-- CreateIndex
CREATE INDEX "idx_organizations_status" ON "Organization"("status");

-- CreateIndex
CREATE INDEX "idx_organizations_concierge_id" ON "Organization"("concierge_id");

-- CreateIndex
CREATE INDEX "idx_organizations_role" ON "Organization"("organization_role");

-- CreateIndex
CREATE INDEX "idx_organizations_industry" ON "Organization"("industry");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_concierge_id_fkey" FOREIGN KEY ("concierge_id") REFERENCES "USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
