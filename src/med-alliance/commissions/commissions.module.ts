import { Module } from '@nestjs/common';
import { CommissionsController } from './commissions.controller';
import { CommissionsService } from './commissions.service';
import { InvoicesService } from '../invoices/invoices.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AllianceNotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, AllianceNotificationsModule],
  controllers: [CommissionsController],
  providers: [CommissionsService, InvoicesService],
  // Export so PayoutRequestsService can access commission records.
  exports: [CommissionsService],
})
export class CommissionsModule {}
