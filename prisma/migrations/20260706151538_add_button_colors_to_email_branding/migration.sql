-- AlterTable
ALTER TABLE "EmailBranding" ADD COLUMN     "button_color" TEXT,
ADD COLUMN     "button_text_color" TEXT;

-- AlterTable
ALTER TABLE "EmailTemplateHistory" ADD COLUMN     "button_url" TEXT;
