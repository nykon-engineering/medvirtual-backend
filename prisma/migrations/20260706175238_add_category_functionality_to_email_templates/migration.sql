-- AlterTable
ALTER TABLE "EmailTemplate" ADD COLUMN     "category" TEXT,
ADD COLUMN     "functionality" TEXT;

-- AlterTable
ALTER TABLE "EmailTemplateHistory" ADD COLUMN     "category" TEXT,
ADD COLUMN     "functionality" TEXT;

-- CreateIndex
CREATE INDEX "idx_email_templates_category" ON "EmailTemplate"("category");

-- CreateIndex
CREATE INDEX "idx_email_templates_functionality" ON "EmailTemplate"("functionality");
