import { Module } from '@nestjs/common';
import { AffiliatesModule } from './affiliates/affiliates.module';
import { ReferredCompaniesModule } from './referred-companies/referred-companies.module';
import { InvoicesModule } from './invoices/invoices.module';
import { CommissionsModule } from './commissions/commissions.module';
import { PayoutRequestsModule } from './payout-requests/payout-requests.module';
import { SyncModule } from './sync/sync.module';
import { ReviewCasesModule } from './review-cases/review-cases.module';

@Module({
  imports: [
    AffiliatesModule,
    ReferredCompaniesModule,
    InvoicesModule,
    CommissionsModule,
    PayoutRequestsModule,
    SyncModule,
    ReviewCasesModule,
  ],
})
export class MedAllianceModule {}
