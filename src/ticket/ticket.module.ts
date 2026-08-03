import { Module } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { TicketAuditService } from './ticket-audit.service';
import { TicketController } from './ticket.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  controllers: [TicketController],
  providers: [TicketService, TicketAuditService],
  imports: [PrismaModule, NotificationsModule],
  exports: [TicketAuditService],
})
export class TicketModule {}
