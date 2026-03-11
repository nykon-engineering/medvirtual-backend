import { Module } from '@nestjs/common';
import { PanelController } from './panel.controller';
import { PanelService } from './panel.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PositionRateConfigModule } from '../position-rate-config/position-rate-config.module';

@Module({
  controllers: [PanelController],
  providers: [PanelService],
  imports: [PrismaModule, PositionRateConfigModule],
})
export class PanelModule {}
