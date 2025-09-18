import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PrismaModule } from '../prisma/prisma.module';
import { HandlerOrganization } from './handlers/organization';
import { HandlerClient } from './handlers/client';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, HandlerOrganization, HandlerClient],
  imports: [PrismaModule]
})
export class DashboardModule {}
