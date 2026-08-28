import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PrismaModule } from '../prisma/prisma.module';
import { HandlerOrganization } from './handlers/organization';
import { HandlerClient } from './handlers/client';
import { HandlerAffiliate } from './handlers/affiliate';
import { HireRequestModule } from '../hire-request/hire-request.module';
import { PositionRateConfigModule } from '../position-rate-config/position-rate-config.module';
import { BusinessUnitsModule } from '../business-units/business-units.module';

@Module({
  controllers: [DashboardController],
  providers: [
    DashboardService,
    HandlerOrganization,
    HandlerClient,
    HandlerAffiliate,
  ],
  imports: [
    PrismaModule,
    HireRequestModule,
    PositionRateConfigModule,
    BusinessUnitsModule,
  ],
})
export class DashboardModule {}
