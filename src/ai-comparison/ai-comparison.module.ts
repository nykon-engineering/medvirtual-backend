import { Module } from '@nestjs/common';
import { GoogledriveModule } from '../googledrive/googledrive.module';
import { OpenrouterModule } from '../openrouter/openrouter.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AiComparisonController } from './ai-comparison.controller';
import { AiComparisonService } from './ai-comparison.service';

@Module({
  imports: [PrismaModule, GoogledriveModule, OpenrouterModule],
  controllers: [AiComparisonController],
  providers: [AiComparisonService],
})
export class AiComparisonModule {}
