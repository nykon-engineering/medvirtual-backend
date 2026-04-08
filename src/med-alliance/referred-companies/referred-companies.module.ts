import { Module } from '@nestjs/common';
import { ReferredCompaniesController } from './referred-companies.controller';
import { ReferredCompaniesService } from './referred-companies.service';
import { EligibilityCheckService } from './eligibility-check.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AffiliatesModule } from '../affiliates/affiliates.module';
import { SyncModule } from '../sync/sync.module';
import { HubspotModule } from '../../hubspot/hubspot.module';

@Module({
  imports: [PrismaModule, AffiliatesModule, SyncModule, HubspotModule],
  controllers: [ReferredCompaniesController],
  providers: [ReferredCompaniesService, EligibilityCheckService],
})
export class ReferredCompaniesModule {}
