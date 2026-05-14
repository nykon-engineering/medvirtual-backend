import { Module } from '@nestjs/common';
import { AffiliatesController } from './affiliates.controller';
import { AffiliatesService } from './affiliates.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { MailModule } from '../../mail/mail.module';
import { HubspotModule } from '../../hubspot/hubspot.module';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [PrismaModule, MailModule, HubspotModule, SyncModule],
  controllers: [AffiliatesController],
  providers: [AffiliatesService],
  // Export service so other Med Alliance modules can use requireActiveProfile().
  exports: [AffiliatesService],
})
export class AffiliatesModule {}
