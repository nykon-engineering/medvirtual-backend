-- CreateIndex
CREATE INDEX "idx_offer_panels_business_unit" ON "OfferPanel"("business_unit");

-- CreateIndex
CREATE INDEX "idx_offer_panels_status_created_at" ON "OfferPanel"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "idx_offer_panels_bu_status_created_at" ON "OfferPanel"("business_unit", "status", "createdAt" DESC);
