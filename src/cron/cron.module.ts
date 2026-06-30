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
import { SyncModule } from '../med-alliance/sync/sync.module';
import { AllianceNotificationsModule } from '../med-alliance/notifications/notifications.module';
import { EmailTemplatesModule } from '../email-templates/email-templates.module';

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
    SyncModule,
    AllianceNotificationsModule,
    EmailTemplatesModule,
  ],
})
export class CronModule {}
