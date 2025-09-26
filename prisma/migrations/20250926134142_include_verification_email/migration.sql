-- CreateTable
CREATE TABLE "Mail_Settings" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mail_Settings_pkey" PRIMARY KEY ("id")
);
