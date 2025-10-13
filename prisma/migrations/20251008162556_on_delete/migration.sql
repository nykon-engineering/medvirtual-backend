-- DropForeignKey
ALTER TABLE "Bonus" DROP CONSTRAINT "Bonus_staff_id_fkey";

-- AddForeignKey
ALTER TABLE "Bonus" ADD CONSTRAINT "Bonus_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
