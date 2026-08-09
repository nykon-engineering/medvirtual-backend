-- CreateEnum
CREATE TYPE "OfferPanelAuditSource" AS ENUM ('user', 'system', 'cron', 'webhook');

-- AlterTable
ALTER TABLE "OfferPanel" ADD COLUMN     "promo_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "OfferPanelAuditLog" (
    "id" TEXT NOT NULL,
    "offer_panel_id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "actor_label" TEXT,
    "event" TEXT NOT NULL,
    "old_status" TEXT,
    "new_status" TEXT,
    "reason" TEXT,
    "source" "OfferPanelAuditSource" NOT NULL DEFAULT 'user',
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferPanelAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_offer_panel_audit_timeline" ON "OfferPanelAuditLog"("offer_panel_id", "createdAt");

-- CreateIndex
CREATE INDEX "idx_offer_panel_audit_actor" ON "OfferPanelAuditLog"("actor_user_id");

-- CreateIndex
CREATE INDEX "idx_offer_panel_audit_event" ON "OfferPanelAuditLog"("event");

-- CreateIndex
CREATE INDEX "idx_offer_panel_audit_created_at" ON "OfferPanelAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "OfferPanelAuditLog" ADD CONSTRAINT "OfferPanelAuditLog_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;
