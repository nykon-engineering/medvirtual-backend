import { Module } from '@nestjs/common';
import { OfferPanelsController } from './offer-panels.controller';
import { PublicOfferPanelsController } from './public-offer-panels.controller';
import { OfferPanelsService } from './offer-panels.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CandidatesModule } from '../candidate/candidates.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { HubspotModule } from '../hubspot/hubspot.module';

@Module({
  imports: [PrismaModule, CandidatesModule, NotificationsModule, HubspotModule],
  controllers: [OfferPanelsController, PublicOfferPanelsController],
  providers: [OfferPanelsService],
  exports: [OfferPanelsService],
})
export class OfferPanelsModule {}
