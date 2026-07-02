import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MailModule } from '../../mail/mail.module';
import { PayoutRequestsModule } from '../payout-requests/payout-requests.module';
import { BillComService } from './bill-com.service';
import { BillComAuthService } from './bill-com-auth.service';
import { BillComPayoutService } from './bill-com-payout.service';
import { BillComPendingCredentialsStore } from './bill-com-pending-credentials.store';
import { BillComWebhookController } from './bill-com-webhook.controller';
import { BillComAdminController } from './bill-com-admin.controller';
import { BillComAuthController } from './bill-com-auth.controller';
import { AllianceNotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    PrismaModule,
    MailModule,
    AllianceNotificationsModule,
    forwardRef(() => PayoutRequestsModule),
  ],
  providers: [
    BillComService,
    BillComAuthService,
    BillComPayoutService,
    BillComPendingCredentialsStore,
  ],
  controllers: [
    BillComWebhookController,
    BillComAdminController,
    BillComAuthController,
  ],
  exports: [BillComService, BillComAuthService, BillComPayoutService],
})
export class BillComModule {}
