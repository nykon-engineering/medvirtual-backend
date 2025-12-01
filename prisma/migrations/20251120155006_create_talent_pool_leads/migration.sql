-- CreateTable
CREATE TABLE "TalentPoolLead" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "organization" VARCHAR(255) NOT NULL,
    "main_need" TEXT,
    "additional_details" TEXT,
    "source" VARCHAR(50) NOT NULL,
    "type" VARCHAR(50) NOT NULL DEFAULT 'Talent Pool Inquiry',
    "status" VARCHAR(50) NOT NULL DEFAULT 'new',
    "assigned_to_user_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contacted_at" TIMESTAMP(3),
    CONSTRAINT "TalentPoolLead_pkey" PRIMARY KEY ("id")
);
