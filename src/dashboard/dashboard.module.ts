import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PrismaModule } from '../prisma/prisma.module';
import { HandlerOrganization } from './handlers/organization';
import { HandlerClient } from './handlers/client';
import { HireRequestModule } from '../hire-request/hire-request.module';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, HandlerOrganization, HandlerClient],
  imports: [PrismaModule, HireRequestModule]
})
export class DashboardModule {}
