-- AlterTable
ALTER TABLE "AffiliateProfile" ADD COLUMN "contact_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateProfile_contact_id_key" ON "AffiliateProfile"("contact_id");

-- AddForeignKey
ALTER TABLE "AffiliateProfile" ADD CONSTRAINT "AffiliateProfile_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
