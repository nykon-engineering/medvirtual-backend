import { Module } from '@nestjs/common';
import { ReviewCasesController } from './review-cases.controller';
import { ReviewCasesService } from './review-cases.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ReviewCasesController],
  providers: [ReviewCasesService],
  exports: [ReviewCasesService],
})
export class ReviewCasesModule {}
