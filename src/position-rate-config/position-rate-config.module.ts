import { Module } from '@nestjs/common';
import { PositionRateConfigService } from './position-rate-config.service';
import { PositionRateConfigController } from './position-rate-config.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PositionRateConfigController],
  providers: [PositionRateConfigService],
  exports: [PositionRateConfigService],
})
export class PositionRateConfigModule {}
