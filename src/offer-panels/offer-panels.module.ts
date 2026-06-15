import { Module } from '@nestjs/common';
import { OfferPanelsController } from './offer-panels.controller';
import { OfferPanelsService } from './offer-panels.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CandidatesModule } from '../candidate/candidates.module';

@Module({
  imports: [PrismaModule, CandidatesModule],
  controllers: [OfferPanelsController],
  providers: [OfferPanelsService],
  exports: [OfferPanelsService],
})
export class OfferPanelsModule {}
