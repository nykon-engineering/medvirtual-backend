import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MailModule } from '../../mail/mail.module';
import { HubspotMatchingService } from './hubspot-matching.service';
import { InvoiceIngestionService } from './invoice-ingestion.service';
import { CommissionDetectionService } from './commission-detection.service';
import { ReferralSyncService } from './referral-sync.service';
import { EligibilityCheckService } from '../referred-companies/eligibility-check.service';

@Module({
  imports: [PrismaModule, MailModule],
  providers: [
    HubspotMatchingService,
    InvoiceIngestionService,
    CommissionDetectionService,
    ReferralSyncService,
    // EligibilityCheckService is used by HubspotMatchingService after a match is resolved
    EligibilityCheckService,
  ],
  exports: [ReferralSyncService],
})
export class SyncModule {}
