import { forwardRef, Module } from '@nestjs/common';
import { OfferPanelsController } from './offer-panels.controller';
import { PublicOfferPanelsController } from './public-offer-panels.controller';
import { OfferPanelsService } from './offer-panels.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CandidatesModule } from '../candidate/candidates.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { HubspotModule } from '../hubspot/hubspot.module';
import { HireRequestModule } from '../hire-request/hire-request.module';
import { BusinessUnitsModule } from '../business-units/business-units.module';
import { TicketAuditService } from '../ticket/ticket-audit.service';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => CandidatesModule),
    NotificationsModule,
    forwardRef(() => HubspotModule),
    forwardRef(() => HireRequestModule),
    BusinessUnitsModule,
  ],
  controllers: [OfferPanelsController, PublicOfferPanelsController],
  providers: [OfferPanelsService, TicketAuditService],
  exports: [OfferPanelsService],
})
export class OfferPanelsModule {}
