import { Module } from '@nestjs/common';
import { AffiliatesModule } from './affiliates/affiliates.module';
import { ReferredCompaniesModule } from './referred-companies/referred-companies.module';
import { InvoicesModule } from './invoices/invoices.module';
import { CommissionsModule } from './commissions/commissions.module';
import { PayoutRequestsModule } from './payout-requests/payout-requests.module';
import { SyncModule } from './sync/sync.module';
import { ReviewCasesModule } from './review-cases/review-cases.module';
import { BillComModule } from './bill-com/bill-com.module';
import { AllianceNotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    AllianceNotificationsModule,
    AffiliatesModule,
    ReferredCompaniesModule,
    InvoicesModule,
    CommissionsModule,
    PayoutRequestsModule,
    SyncModule,
    ReviewCasesModule,
    BillComModule,
  ],
})
export class MedAllianceModule {}
