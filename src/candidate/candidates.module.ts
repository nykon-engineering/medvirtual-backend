import { Module } from '@nestjs/common';
import { CandidatesService } from './candidates.service';
import { CandidatesController } from './candidates.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { GoogledriveModule } from '../googledrive/googledrive.module';
import { TextractModule } from '../textract/textract.module';
import { S3Module } from '../s3/s3.module';
import { OpenaiModule } from '../openai/openai.module';

@Module({
  controllers: [CandidatesController],
  providers: [CandidatesService],
  imports: [PrismaModule, GoogledriveModule, TextractModule, S3Module, OpenaiModule]
})
export class CandidatesModule {}
