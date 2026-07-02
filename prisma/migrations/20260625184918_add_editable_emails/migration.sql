-- CreateTable
CREATE TABLE "BusinessUnit" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "BusinessUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT NOT NULL,
    "headline" TEXT,
    "body" TEXT NOT NULL,
    "button_label" TEXT,
    "button_url" TEXT,
    "placeholders" JSONB NOT NULL DEFAULT '[]',
    "business_unit" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplateHistory" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "headline" TEXT,
    "body" TEXT NOT NULL,
    "button_label" TEXT,
    "changed_by" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "EmailTemplateHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailBranding" (
    "id" TEXT NOT NULL,
    "business_unit" TEXT NOT NULL,
    "primary_color" TEXT NOT NULL,
    "secondary_color" TEXT,
    "logo_url" TEXT,
    "company_name" TEXT NOT NULL,
    "layout_preset" TEXT NOT NULL DEFAULT 'default',
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailBranding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailBrandingHistory" (
    "id" TEXT NOT NULL,
    "branding_id" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changed_by" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailBrandingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessUnit_slug_key" ON "BusinessUnit"("slug");

-- CreateIndex
CREATE INDEX "idx_business_units_is_active" ON "BusinessUnit"("is_active");

-- CreateIndex
CREATE INDEX "idx_email_templates_key" ON "EmailTemplate"("key");

-- CreateIndex
CREATE INDEX "idx_email_templates_bu" ON "EmailTemplate"("business_unit");

-- CreateIndex
CREATE INDEX "idx_email_templates_is_active" ON "EmailTemplate"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "idx_email_templates_key_bu" ON "EmailTemplate"("key", "business_unit");

-- CreateIndex
CREATE INDEX "idx_email_template_history_template_id" ON "EmailTemplateHistory"("template_id");

-- CreateIndex
CREATE INDEX "idx_email_template_history_changed_at" ON "EmailTemplateHistory"("changed_at");

-- CreateIndex
CREATE UNIQUE INDEX "EmailBranding_business_unit_key" ON "EmailBranding"("business_unit");

-- CreateIndex
CREATE INDEX "idx_email_branding_bu" ON "EmailBranding"("business_unit");

-- CreateIndex
CREATE INDEX "idx_email_branding_history_branding_id" ON "EmailBrandingHistory"("branding_id");

-- CreateIndex
CREATE INDEX "idx_email_branding_history_changed_at" ON "EmailBrandingHistory"("changed_at");

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_business_unit_fkey" FOREIGN KEY ("business_unit") REFERENCES "BusinessUnit"("slug") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplateHistory" ADD CONSTRAINT "EmailTemplateHistory_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "EmailTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailBranding" ADD CONSTRAINT "EmailBranding_business_unit_fkey" FOREIGN KEY ("business_unit") REFERENCES "BusinessUnit"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailBrandingHistory" ADD CONSTRAINT "EmailBrandingHistory_branding_id_fkey" FOREIGN KEY ("branding_id") REFERENCES "EmailBranding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
