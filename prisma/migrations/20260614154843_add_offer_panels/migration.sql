-- CreateEnum
CREATE TYPE "OfferPanelStatus" AS ENUM ('sent', 'viewed', 'accepted', 'declined');

-- CreateEnum
CREATE TYPE "OfferPanelRecipientType" AS ENUM ('client_user', 'company_contact', 'email');

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "offer_panel_id" TEXT;

-- CreateTable
CREATE TABLE "OfferPanel" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "business_unit" TEXT NOT NULL,
    "status" "OfferPanelStatus" NOT NULL DEFAULT 'sent',
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "recipient_type" "OfferPanelRecipientType" NOT NULL,
    "recipient_user_id" TEXT,
    "recipient_company_id" TEXT,
    "recipient_name" TEXT NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "recipient_org_name" TEXT,
    "public_token" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "viewed_at" TIMESTAMP(3),
    "last_viewed_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "decided_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferPanel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferPanelCandidate" (
    "id" TEXT NOT NULL,
    "offer_panel_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferPanelCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OfferPanel_public_token_key" ON "OfferPanel"("public_token");

-- CreateIndex
CREATE INDEX "idx_offer_panels_status" ON "OfferPanel"("status");

-- CreateIndex
CREATE INDEX "idx_offer_panels_created_by" ON "OfferPanel"("created_by_user_id");

-- CreateIndex
CREATE INDEX "idx_offer_panels_recipient_user" ON "OfferPanel"("recipient_user_id");

-- CreateIndex
CREATE INDEX "idx_offer_panels_recipient_company" ON "OfferPanel"("recipient_company_id");

-- CreateIndex
CREATE INDEX "idx_offer_panels_recipient_type" ON "OfferPanel"("recipient_type");

-- CreateIndex
CREATE INDEX "idx_offer_panels_created_at" ON "OfferPanel"("createdAt");

-- CreateIndex
CREATE INDEX "idx_offer_panel_candidates_panel_id" ON "OfferPanelCandidate"("offer_panel_id");

-- CreateIndex
CREATE INDEX "idx_offer_panel_candidates_candidate_id" ON "OfferPanelCandidate"("candidate_id");

-- CreateIndex
CREATE UNIQUE INDEX "OfferPanelCandidate_offer_panel_id_candidate_id_key" ON "OfferPanelCandidate"("offer_panel_id", "candidate_id");

-- CreateIndex
CREATE INDEX "idx_tickets_offer_panel_id" ON "Ticket"("offer_panel_id");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_offer_panel_id_fkey" FOREIGN KEY ("offer_panel_id") REFERENCES "OfferPanel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferPanel" ADD CONSTRAINT "OfferPanel_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferPanel" ADD CONSTRAINT "OfferPanel_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferPanel" ADD CONSTRAINT "OfferPanel_recipient_company_id_fkey" FOREIGN KEY ("recipient_company_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferPanelCandidate" ADD CONSTRAINT "OfferPanelCandidate_offer_panel_id_fkey" FOREIGN KEY ("offer_panel_id") REFERENCES "OfferPanel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferPanelCandidate" ADD CONSTRAINT "OfferPanelCandidate_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
