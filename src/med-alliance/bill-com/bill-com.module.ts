import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MailModule } from '../../mail/mail.module';
import { PayoutRequestsModule } from '../payout-requests/payout-requests.module';
import { BillComService } from './bill-com.service';
import { BillComPayoutService } from './bill-com-payout.service';
import { BillComWebhookController } from './bill-com-webhook.controller';
import { BillComAdminController } from './bill-com-admin.controller';
import { AllianceNotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    PrismaModule,
    MailModule,
    AllianceNotificationsModule,
    forwardRef(() => PayoutRequestsModule),
  ],
  providers: [BillComService, BillComPayoutService],
  controllers: [BillComWebhookController, BillComAdminController],
  exports: [BillComService, BillComPayoutService],
})
export class BillComModule {}
