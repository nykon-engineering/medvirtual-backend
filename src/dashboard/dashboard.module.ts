import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
  imports: [PrismaModule]
})
export class DashboardModule {}
