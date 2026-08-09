import { forwardRef, Module } from '@nestjs/common';
import { PayoutRequestsController } from './payout-requests.controller';
import { PayoutRequestsService } from './payout-requests.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AffiliatesModule } from '../affiliates/affiliates.module';
import { AllianceNotificationsModule } from '../notifications/notifications.module';
import { BillComModule } from '../bill-com/bill-com.module';

@Module({
  imports: [
    PrismaModule,
    AffiliatesModule,
    AllianceNotificationsModule,
    forwardRef(() => BillComModule),
  ],
  controllers: [PayoutRequestsController],
  providers: [PayoutRequestsService],
  exports: [PayoutRequestsService],
})
export class PayoutRequestsModule {}
