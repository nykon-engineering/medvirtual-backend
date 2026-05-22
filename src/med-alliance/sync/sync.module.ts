import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MailModule } from '../../mail/mail.module';
import { HubspotMatchingService } from './hubspot-matching.service';
import { InvoiceIngestionService } from './invoice-ingestion.service';
import { CommissionDetectionService } from './commission-detection.service';
import { ReferralSyncService } from './referral-sync.service';
import { EligibilityCheckService } from '../referred-companies/eligibility-check.service';
import { ReviewCasesModule } from '../review-cases/review-cases.module';
import { AllianceNotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    PrismaModule,
    MailModule,
    ReviewCasesModule,
    AllianceNotificationsModule,
  ],
  providers: [
    HubspotMatchingService,
    InvoiceIngestionService,
    CommissionDetectionService,
    ReferralSyncService,
    // EligibilityCheckService is used by HubspotMatchingService after a match is resolved
    EligibilityCheckService,
  ],
  exports: [ReferralSyncService, InvoiceIngestionService],
})
export class SyncModule {}
