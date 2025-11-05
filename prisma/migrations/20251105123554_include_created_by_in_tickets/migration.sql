-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;
