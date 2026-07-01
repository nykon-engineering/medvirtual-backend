/*
  Warnings:

  - You are about to drop the `BusinessUnit` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EmailBranding` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EmailBrandingHistory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EmailTemplate` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EmailTemplateHistory` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "EmailBranding" DROP CONSTRAINT "EmailBranding_business_unit_fkey";

-- DropForeignKey
ALTER TABLE "EmailBrandingHistory" DROP CONSTRAINT "EmailBrandingHistory_branding_id_fkey";

-- DropForeignKey
ALTER TABLE "EmailTemplate" DROP CONSTRAINT "EmailTemplate_business_unit_fkey";

-- DropForeignKey
ALTER TABLE "EmailTemplateHistory" DROP CONSTRAINT "EmailTemplateHistory_template_id_fkey";

-- AlterTable
ALTER TABLE "USER" ADD COLUMN     "billcom_device" TEXT,
ADD COLUMN     "billcom_pending_session_id" TEXT,
ADD COLUMN     "billcom_remember_me_id" TEXT,
ADD COLUMN     "billcom_session_expires" TIMESTAMP(3),
ADD COLUMN     "billcom_session_id" TEXT;

-- DropTable
DROP TABLE "BusinessUnit";

-- DropTable
DROP TABLE "EmailBranding";

-- DropTable
DROP TABLE "EmailBrandingHistory";

-- DropTable
DROP TABLE "EmailTemplate";

-- DropTable
DROP TABLE "EmailTemplateHistory";
