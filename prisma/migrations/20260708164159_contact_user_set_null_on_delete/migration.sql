-- DropForeignKey
ALTER TABLE "Contact" DROP CONSTRAINT "Contact_user_id_fkey";

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;
