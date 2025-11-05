-- CreateEnum
CREATE TYPE "Priority_new" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- CreateTable
CREATE TABLE "TicketNotes" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "TicketNotes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TicketNotes" ADD CONSTRAINT "TicketNotes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "USER"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "TicketNotes" ADD CONSTRAINT "TicketNotes_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
