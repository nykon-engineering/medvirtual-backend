import { Module } from '@nestjs/common';
import { PayoutRequestsController } from './payout-requests.controller';
import { PayoutRequestsService } from './payout-requests.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AffiliatesModule } from '../affiliates/affiliates.module';

@Module({
  imports: [PrismaModule, AffiliatesModule],
  controllers: [PayoutRequestsController],
  providers: [PayoutRequestsService],
  exports: [PayoutRequestsService],
})
export class PayoutRequestsModule {}
