import { Module } from '@nestjs/common';
import { AffiliatesController } from './affiliates.controller';
import { AffiliatesService } from './affiliates.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { MailModule } from '../../mail/mail.module';
import { HubspotModule } from '../../hubspot/hubspot.module';
import { SyncModule } from '../sync/sync.module';
import { AllianceNotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    PrismaModule,
    MailModule,
    HubspotModule,
    SyncModule,
    AllianceNotificationsModule,
  ],
  controllers: [AffiliatesController],
  providers: [AffiliatesService],
  // Export service so other Med Alliance modules can use requireActiveProfile().
  exports: [AffiliatesService],
})
export class AffiliatesModule {}
