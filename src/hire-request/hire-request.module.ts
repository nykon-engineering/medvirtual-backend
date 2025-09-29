import { Module } from '@nestjs/common';
import { HireRequestService } from './hire-request.service';
import { HireRequestController } from './hire-request.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { HubspotModule } from '../hubspot/hubspot.module';

@Module({
  controllers: [HireRequestController],
  providers: [HireRequestService],
  imports: [PrismaModule, HubspotModule],
  exports: [HireRequestService],
})
export class HireRequestModule {}
