import { Module } from '@nestjs/common';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { HubspotModule } from '../hubspot/hubspot.module';
import { TicketAuditService } from '../ticket/ticket-audit.service';

@Module({
  controllers: [StaffController],
  // TicketAuditService is provided directly rather than by importing TicketModule: it only
  // depends on Prisma, and pulling in the whole module would drag the controller along.
  providers: [StaffService, TicketAuditService],
  imports: [PrismaModule, HubspotModule],
})
export class StaffModule {}
