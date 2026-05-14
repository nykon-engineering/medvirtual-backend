import { Module } from '@nestjs/common';
import { CronController } from './cron.controller';
import { CronService } from './cron.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CandidatesModule } from '../candidate/candidates.module';
import { HubspotModule } from '../hubspot/hubspot.module';
import { MailModule } from '../mail/mail.module';
import { HireRequestModule } from '../hire-request/hire-request.module';
import { PositionRateConfigModule } from '../position-rate-config/position-rate-config.module';
import { PayoutRequestsModule } from '../med-alliance/payout-requests/payout-requests.module';

@Module({
  controllers: [CronController],
  providers: [CronService],
  imports: [
    PrismaModule,
    CandidatesModule,
    HubspotModule,
    MailModule,
    HireRequestModule,
    PositionRateConfigModule,
    PayoutRequestsModule,
  ],
})
export class CronModule {}
