import { Module } from '@nestjs/common';
import { ReferredCompaniesController } from './referred-companies.controller';
import { ReferredCompaniesService } from './referred-companies.service';
import { EligibilityCheckService } from './eligibility-check.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AffiliatesModule } from '../affiliates/affiliates.module';
import { SyncModule } from '../sync/sync.module';
import { HubspotModule } from '../../hubspot/hubspot.module';
import { ReviewCasesModule } from '../review-cases/review-cases.module';
import { OrganizationModule } from '../../organization/organization.module';
import { ContactModule } from '../../contacts/contacts.module';
import { AllianceNotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    PrismaModule,
    AffiliatesModule,
    SyncModule,
    HubspotModule,
    ReviewCasesModule,
    OrganizationModule,
    ContactModule,
    AllianceNotificationsModule,
  ],
  controllers: [ReferredCompaniesController],
  providers: [ReferredCompaniesService, EligibilityCheckService],
})
export class ReferredCompaniesModule {}
