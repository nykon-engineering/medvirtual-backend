-- CreateEnum
CREATE TYPE "TicketAuditSource" AS ENUM ('user', 'system', 'cron', 'webhook');

-- AlterTable
ALTER TABLE "Bonus" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by" TEXT,
ADD COLUMN     "deletion_reason" TEXT;

-- CreateTable
CREATE TABLE "TicketAuditLog" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "actor_label" TEXT,
    "event" TEXT NOT NULL,
    "old_status" TEXT,
    "new_status" TEXT,
    "reason" TEXT,
    "source" "TicketAuditSource" NOT NULL DEFAULT 'user',
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_ticket_audit_timeline" ON "TicketAuditLog"("ticket_id", "createdAt");

-- CreateIndex
CREATE INDEX "idx_ticket_audit_actor" ON "TicketAuditLog"("actor_user_id");

-- CreateIndex
CREATE INDEX "idx_ticket_audit_event" ON "TicketAuditLog"("event");

-- CreateIndex
CREATE INDEX "idx_ticket_audit_created_at" ON "TicketAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "idx_bonus_deleted_at" ON "Bonus"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_tickets_deleted_at" ON "Ticket"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_tickets_deleted_at_status" ON "Ticket"("deleted_at", "status");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAuditLog" ADD CONSTRAINT "TicketAuditLog_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;
