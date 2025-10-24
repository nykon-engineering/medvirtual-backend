/*
  Warnings:

  - Added the required column `link` to the `Interview` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Interview" ADD COLUMN     "alert_closed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "link" TEXT NOT NULL;
