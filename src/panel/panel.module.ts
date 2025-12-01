import { Module } from '@nestjs/common';
import { PanelController } from './panel.controller';
import { PanelService } from './panel.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [PanelController],
  providers: [PanelService],
  imports: [PrismaModule],
})
export class PanelModule {}
