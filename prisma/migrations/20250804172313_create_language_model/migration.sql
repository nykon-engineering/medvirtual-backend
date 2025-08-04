-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "country" TEXT,
ADD COLUMN     "specialization" TEXT;

-- CreateTable
CREATE TABLE "CandidateLanguage" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateLanguage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CandidateLanguage" ADD CONSTRAINT "CandidateLanguage_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
