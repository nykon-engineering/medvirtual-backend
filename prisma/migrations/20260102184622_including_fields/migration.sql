-- AlterTable
ALTER TABLE "HireRequest" ADD COLUMN     "cancel_date" TIMESTAMP(3),
ADD COLUMN     "cancel_reason" TEXT;
