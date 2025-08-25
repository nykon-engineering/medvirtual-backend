/*
  Warnings:

  - You are about to drop the column `requirements` on the `HireRequest` table. All the data in the column will be lost.
  - Added the required column `availability` to the `HireRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `specialization` to the `HireRequest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "HireRequest" DROP COLUMN "requirements",
ADD COLUMN     "Location" TEXT,
ADD COLUMN     "availability" TEXT NOT NULL,
ADD COLUMN     "contract_length" TEXT,
ADD COLUMN     "expected_start_date" TIMESTAMP(3),
ADD COLUMN     "salary_range_from" DECIMAL(65,30),
ADD COLUMN     "salary_range_to" DECIMAL(65,30),
ADD COLUMN     "specialization" TEXT NOT NULL;
