/*
  Warnings:

  - Added the required column `email_from` to the `EmailInvitation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EmailInvitation" ADD COLUMN     "email_from" TEXT NOT NULL;
