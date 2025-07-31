import { Module } from '@nestjs/common';
import { CandidatesService } from './candidates.service';
import { CandidatesController } from './candidates.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { GoogledriveModule } from '../googledrive/googledrive.module';

@Module({
  controllers: [CandidatesController],
  providers: [CandidatesService],
  imports: [PrismaModule, GoogledriveModule]
})
export class CandidatesModule {}
