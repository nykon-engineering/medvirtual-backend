-- CreateEnum
CREATE TYPE "BillingMode" AS ENUM ('arrears', 'prebill');

-- CreateEnum
CREATE TYPE "BillingFrequency" AS ENUM ('weekly', 'biweekly', 'monthly', 'custom');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'under_review', 'approved', 'published', 'partially_paid', 'paid', 'voided', 'cancelled');

-- CreateEnum
CREATE TYPE "InvoiceVersionStatus" AS ENUM ('draft', 'under_review', 'approved', 'published', 'voided');

-- CreateEnum
CREATE TYPE "InvoiceLineType" AS ENUM ('primary', 'additional');

-- CreateEnum
CREATE TYPE "InvoiceLineCategory" AS ENUM ('monthly_service', 'hourly_service', 'overtime', 'pto', 'holiday', 'bonus', 'reconciliation_credit', 'reconciliation_debit', 'manual_charge', 'manual_credit', 'setup_fee', 'software_fee', 'penalty', 'tax');

-- CreateEnum
CREATE TYPE "AdjustmentType" AS ENUM ('fixed', 'percent');

-- CreateEnum
CREATE TYPE "HourBreakdownType" AS ENUM ('worked', 'pto', 'holiday');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('pending', 'processing', 'completed', 'disputed', 'reversed');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('credit', 'debit');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('submitted', 'approved', 'rejected', 'changes_requested');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('stripe');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'partially_paid', 'paid', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('queued', 'processing', 'success', 'failed');

-- CreateEnum
CREATE TYPE "InvoiceJobStatus" AS ENUM ('queued', 'processing', 'completed', 'partial_success', 'failed');

-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "hubstaff_id" TEXT;

-- CreateTable
CREATE TABLE "InvoiceConfiguration" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "hubstaff_id" TEXT,
    "hubspot_id" TEXT,
    "billing_mode" "BillingMode" NOT NULL DEFAULT 'arrears',
    "billing_frequency" "BillingFrequency" NOT NULL DEFAULT 'monthly',
    "billing_currency" TEXT NOT NULL DEFAULT 'USD',
    "payment_terms_days" INTEGER NOT NULL DEFAULT 7,
    "cycle_anchor_day" INTEGER,
    "auto_submit_invoices" BOOLEAN NOT NULL DEFAULT false,
    "auto_publish_invoices" BOOLEAN NOT NULL DEFAULT false,
    "auto_sync_to_stripe" BOOLEAN NOT NULL DEFAULT true,
    "requires_reconciliation" BOOLEAN NOT NULL DEFAULT false,
    "reconciliation_delay_days" INTEGER NOT NULL DEFAULT 0,
    "credit_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "debit_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "auto_apply_credits" BOOLEAN NOT NULL DEFAULT true,
    "default_operations_cost" DECIMAL(14,2),
    "default_medvirtual_fee" DECIMAL(14,2),
    "default_hourly_rate" DECIMAL(14,2),
    "stripe_customer_id" TEXT,
    "allow_outstanding_balance" BOOLEAN NOT NULL DEFAULT true,
    "credit_hold_threshold" DECIMAL(14,2),
    "show_fee_breakdown_on_invoice" BOOLEAN NOT NULL DEFAULT false,
    "require_super_admin_publish" BOOLEAN NOT NULL DEFAULT false,
    "billing_notes" TEXT,
    "billing_activated_at" TIMESTAMP(3),
    "billing_paused_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "current_version_id" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'draft',
    "billing_start_date" TIMESTAMP(3) NOT NULL,
    "billing_end_date" TIMESTAMP(3) NOT NULL,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "reference" TEXT,
    "invoice_number" TEXT,
    "created_by" TEXT NOT NULL,
    "voided_by" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "stripe_invoice_id" TEXT,
    "stripe_invoice_number" TEXT,
    "stripe_status" TEXT,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceVersion" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" "InvoiceVersionStatus" NOT NULL DEFAULT 'draft',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "issue_date" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "public_due_date" TIMESTAMP(3),
    "billing_start_date" TIMESTAMP(3),
    "billing_end_date" TIMESTAMP(3),
    "is_prebill" BOOLEAN NOT NULL DEFAULT false,
    "allow_fees" BOOLEAN NOT NULL DEFAULT false,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discountType" TEXT NOT NULL DEFAULT 'dollar',
    "discountValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "internal_notes" TEXT,
    "reviewed_by" TEXT,
    "approved_by" TEXT,
    "published_by" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLineItem" (
    "id" TEXT NOT NULL,
    "invoice_version_id" TEXT NOT NULL,
    "parent_line_item_id" TEXT,
    "ticket_id" TEXT,
    "worker_id" TEXT,
    "worker_name_snapshot" TEXT,
    "is_full_time" BOOLEAN NOT NULL DEFAULT false,
    "type" "InvoiceLineType" NOT NULL,
    "category" "InvoiceLineCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "source_worked_hours" DECIMAL(10,2),
    "manual_override_worked_hours" DECIMAL(10,2),
    "effective_worked_hours" DECIMAL(10,2),
    "total_hours_worked" DECIMAL(10,2),
    "total_pto_hours" DECIMAL(10,2),
    "total_holiday_hours" DECIMAL(10,2),
    "total_hours_payable" DECIMAL(10,2),
    "hourly_rate" DECIMAL(14,2),
    "service_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "operations_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "medvirtual_fees" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "subtotal_before_adjustment" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "adjustment_type" "AdjustmentType",
    "adjustment_value" DECIMAL(14,2),
    "adjustment_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "final_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLineHourBreakdown" (
    "id" TEXT NOT NULL,
    "line_item_id" TEXT NOT NULL,
    "hour_type" "HourBreakdownType" NOT NULL,
    "hours" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceLineHourBreakdown_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLineAdjustmentHistory" (
    "id" TEXT NOT NULL,
    "line_item_id" TEXT NOT NULL,
    "old_type" "AdjustmentType",
    "old_value" DECIMAL(14,2),
    "new_type" "AdjustmentType",
    "new_value" DECIMAL(14,2),
    "changed_by" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceLineAdjustmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLineReconciliation" (
    "id" TEXT NOT NULL,
    "line_item_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "worker_id" TEXT,
    "estimated_amount" DECIMAL(14,2) NOT NULL,
    "actual_amount" DECIMAL(14,2) NOT NULL,
    "delta_amount" DECIMAL(14,2) NOT NULL,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'pending',
    "created_by" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "InvoiceLineReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingLedgerEntry" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "worker_id" TEXT,
    "line_item_id" TEXT,
    "reconciliation_id" TEXT,
    "direction" "LedgerDirection" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "remaining_amount" DECIMAL(14,2) NOT NULL,
    "applied_to_line_item_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceReview" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "submitted_by" TEXT NOT NULL,
    "reviewed_by" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'submitted',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "InvoiceReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceComment" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoicePayment" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'stripe',
    "provider_reference" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "paid_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceExternalSync" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'stripe',
    "status" "SyncStatus" NOT NULL,
    "request_payload" JSONB,
    "response_payload" JSONB,
    "error_message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceExternalSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceAuditLog" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT,
    "invoice_version_id" TEXT,
    "line_item_id" TEXT,
    "actor_id" TEXT,
    "event" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingCycleStats" (
    "id" TEXT NOT NULL,
    "billing_start_date" TIMESTAMP(3) NOT NULL,
    "billing_end_date" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "invoice_count" INTEGER NOT NULL DEFAULT 0,
    "published_invoice_count" INTEGER NOT NULL DEFAULT 0,
    "paid_invoice_count" INTEGER NOT NULL DEFAULT 0,
    "overdue_invoice_count" INTEGER NOT NULL DEFAULT 0,
    "voided_invoice_count" INTEGER NOT NULL DEFAULT 0,
    "organization_count" INTEGER NOT NULL DEFAULT 0,
    "billed_worker_count" INTEGER NOT NULL DEFAULT 0,
    "gross_service_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_operations_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_medvirtual_fees" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_adjustments" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "reconciliation_credits" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "reconciliation_debits" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "invoice_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "payments_received" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "outstanding_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingCycleStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationBillingStats" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "billing_start_date" TIMESTAMP(3) NOT NULL,
    "billing_end_date" TIMESTAMP(3) NOT NULL,
    "invoice_total" DECIMAL(14,2) NOT NULL,
    "paid_total" DECIMAL(14,2) NOT NULL,
    "outstanding_total" DECIMAL(14,2) NOT NULL,
    "worker_count" INTEGER NOT NULL,
    "fees_total" DECIMAL(14,2) NOT NULL,
    "adjustments_total" DECIMAL(14,2) NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationBillingStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerBillingStats" (
    "id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "billing_start_date" TIMESTAMP(3) NOT NULL,
    "billing_end_date" TIMESTAMP(3) NOT NULL,
    "hours_worked" DECIMAL(10,2) NOT NULL,
    "pto_hours" DECIMAL(10,2) NOT NULL,
    "holiday_hours" DECIMAL(10,2) NOT NULL,
    "payable_hours" DECIMAL(10,2) NOT NULL,
    "revenue_generated" DECIMAL(14,2) NOT NULL,
    "fees_generated" DECIMAL(14,2) NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerBillingStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceJob" (
    "id" TEXT NOT NULL,
    "status" "InvoiceJobStatus" NOT NULL DEFAULT 'queued',
    "total_tasks" INTEGER NOT NULL DEFAULT 0,
    "completed_tasks" INTEGER NOT NULL DEFAULT 0,
    "failed_tasks" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB,
    "result" JSONB,
    "error_message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceConfiguration_organization_id_key" ON "InvoiceConfiguration"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceConfiguration_stripe_customer_id_key" ON "InvoiceConfiguration"("stripe_customer_id");

-- CreateIndex
CREATE INDEX "idx_invoice_configurations_org_id" ON "InvoiceConfiguration"("organization_id");

-- CreateIndex
CREATE INDEX "idx_invoice_configurations_stripe_id" ON "InvoiceConfiguration"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_current_version_id_key" ON "Invoice"("current_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_reference_key" ON "Invoice"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoice_number_key" ON "Invoice"("invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_stripe_invoice_id_key" ON "Invoice"("stripe_invoice_id");

-- CreateIndex
CREATE INDEX "idx_invoice_org" ON "Invoice"("organization_id");

-- CreateIndex
CREATE INDEX "idx_invoice_status" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "idx_invoice_created" ON "Invoice"("createdAt");

-- CreateIndex
CREATE INDEX "idx_invoice_cycle" ON "Invoice"("organization_id", "billing_start_date", "billing_end_date");

-- CreateIndex
CREATE INDEX "idx_invoice_version_invoice" ON "InvoiceVersion"("invoice_id");

-- CreateIndex
CREATE INDEX "idx_invoice_version_status" ON "InvoiceVersion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_invoice_version_number" ON "InvoiceVersion"("invoice_id", "version_number");

-- CreateIndex
CREATE INDEX "idx_line_invoice_version" ON "InvoiceLineItem"("invoice_version_id");

-- CreateIndex
CREATE INDEX "idx_line_worker" ON "InvoiceLineItem"("worker_id");

-- CreateIndex
CREATE INDEX "idx_line_type" ON "InvoiceLineItem"("type");

-- CreateIndex
CREATE INDEX "idx_line_category" ON "InvoiceLineItem"("category");

-- CreateIndex
CREATE INDEX "idx_line_hour_line" ON "InvoiceLineHourBreakdown"("line_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_line_hour_type" ON "InvoiceLineHourBreakdown"("line_item_id", "hour_type");

-- CreateIndex
CREATE INDEX "idx_adj_history_line" ON "InvoiceLineAdjustmentHistory"("line_item_id");

-- CreateIndex
CREATE INDEX "idx_recon_org" ON "InvoiceLineReconciliation"("organization_id");

-- CreateIndex
CREATE INDEX "idx_recon_worker" ON "InvoiceLineReconciliation"("worker_id");

-- CreateIndex
CREATE INDEX "idx_recon_status" ON "InvoiceLineReconciliation"("status");

-- CreateIndex
CREATE INDEX "idx_ledger_org" ON "BillingLedgerEntry"("organization_id");

-- CreateIndex
CREATE INDEX "idx_ledger_worker" ON "BillingLedgerEntry"("worker_id");

-- CreateIndex
CREATE INDEX "idx_review_invoice" ON "InvoiceReview"("invoice_id");

-- CreateIndex
CREATE INDEX "idx_comment_invoice" ON "InvoiceComment"("invoice_id");

-- CreateIndex
CREATE INDEX "idx_payment_invoice" ON "InvoicePayment"("invoice_id");

-- CreateIndex
CREATE INDEX "idx_payment_status" ON "InvoicePayment"("status");

-- CreateIndex
CREATE INDEX "idx_sync_invoice" ON "InvoiceExternalSync"("invoice_id");

-- CreateIndex
CREATE INDEX "idx_audit_invoice" ON "InvoiceAuditLog"("invoice_id");

-- CreateIndex
CREATE INDEX "idx_audit_line" ON "InvoiceAuditLog"("line_item_id");

-- CreateIndex
CREATE INDEX "idx_audit_created" ON "InvoiceAuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCycleStats_billing_start_date_billing_end_date_curre_key" ON "BillingCycleStats"("billing_start_date", "billing_end_date", "currency");

-- CreateIndex
CREATE INDEX "OrganizationBillingStats_organization_id_idx" ON "OrganizationBillingStats"("organization_id");

-- CreateIndex
CREATE INDEX "InvoiceJob_status_idx" ON "InvoiceJob"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_hubstaff_id_key" ON "Candidate"("hubstaff_id");

-- AddForeignKey
ALTER TABLE "InvoiceConfiguration" ADD CONSTRAINT "InvoiceConfiguration_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "InvoiceVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceVersion" ADD CONSTRAINT "InvoiceVersion_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceVersion" ADD CONSTRAINT "InvoiceVersion_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceVersion" ADD CONSTRAINT "InvoiceVersion_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceVersion" ADD CONSTRAINT "InvoiceVersion_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceVersion" ADD CONSTRAINT "InvoiceVersion_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoice_version_id_fkey" FOREIGN KEY ("invoice_version_id") REFERENCES "InvoiceVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_parent_line_item_id_fkey" FOREIGN KEY ("parent_line_item_id") REFERENCES "InvoiceLineItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineHourBreakdown" ADD CONSTRAINT "InvoiceLineHourBreakdown_line_item_id_fkey" FOREIGN KEY ("line_item_id") REFERENCES "InvoiceLineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineAdjustmentHistory" ADD CONSTRAINT "InvoiceLineAdjustmentHistory_line_item_id_fkey" FOREIGN KEY ("line_item_id") REFERENCES "InvoiceLineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineAdjustmentHistory" ADD CONSTRAINT "InvoiceLineAdjustmentHistory_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineReconciliation" ADD CONSTRAINT "InvoiceLineReconciliation_line_item_id_fkey" FOREIGN KEY ("line_item_id") REFERENCES "InvoiceLineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineReconciliation" ADD CONSTRAINT "InvoiceLineReconciliation_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineReconciliation" ADD CONSTRAINT "InvoiceLineReconciliation_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingLedgerEntry" ADD CONSTRAINT "BillingLedgerEntry_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingLedgerEntry" ADD CONSTRAINT "BillingLedgerEntry_line_item_id_fkey" FOREIGN KEY ("line_item_id") REFERENCES "InvoiceLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingLedgerEntry" ADD CONSTRAINT "BillingLedgerEntry_reconciliation_id_fkey" FOREIGN KEY ("reconciliation_id") REFERENCES "InvoiceLineReconciliation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingLedgerEntry" ADD CONSTRAINT "BillingLedgerEntry_applied_to_line_item_id_fkey" FOREIGN KEY ("applied_to_line_item_id") REFERENCES "InvoiceLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceReview" ADD CONSTRAINT "InvoiceReview_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceReview" ADD CONSTRAINT "InvoiceReview_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceReview" ADD CONSTRAINT "InvoiceReview_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceComment" ADD CONSTRAINT "InvoiceComment_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceComment" ADD CONSTRAINT "InvoiceComment_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceExternalSync" ADD CONSTRAINT "InvoiceExternalSync_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceAuditLog" ADD CONSTRAINT "InvoiceAuditLog_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceAuditLog" ADD CONSTRAINT "InvoiceAuditLog_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceAuditLog" ADD CONSTRAINT "InvoiceAuditLog_line_item_id_fkey" FOREIGN KEY ("line_item_id") REFERENCES "InvoiceLineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

