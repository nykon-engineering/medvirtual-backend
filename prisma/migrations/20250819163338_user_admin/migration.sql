/*
  Warnings:

  - Added the required column `admin_id` to the `Organization` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "admin_id" TEXT;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
