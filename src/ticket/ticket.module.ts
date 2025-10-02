import { Module } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { TicketController } from './ticket.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  controllers: [TicketController],
  providers: [TicketService],
  imports: [PrismaModule, NotificationsModule],
})
export class TicketModule {}
