-- CreateTable
CREATE TABLE "Sync" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "last_synced_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sync_pkey" PRIMARY KEY ("id")
);
