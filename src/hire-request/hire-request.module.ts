import { Module } from '@nestjs/common';
import { HireRequestService } from './hire-request.service';
import { HireRequestController } from './hire-request.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { HubspotModule } from '../hubspot/hubspot.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  controllers: [HireRequestController],
  providers: [HireRequestService],
  imports: [PrismaModule, HubspotModule, NotificationsModule],
  exports: [HireRequestService],
})
export class HireRequestModule {}
