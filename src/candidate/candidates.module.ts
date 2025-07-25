import { Module } from '@nestjs/common';
import { CandidatesService } from './candidates.service';
import { CandidatesController } from './candidates.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [CandidatesController],
  providers: [CandidatesService],
  imports: [PrismaModule]
})
export class CandidatesModule {}
