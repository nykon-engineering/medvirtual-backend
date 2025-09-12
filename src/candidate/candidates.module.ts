import { forwardRef, Module } from '@nestjs/common';
import { CandidatesService } from './candidates.service';
import { CandidatesController } from './candidates.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { GoogledriveModule } from '../googledrive/googledrive.module';
import { TextractModule } from '../textract/textract.module';
import { S3Module } from '../s3/s3.module';
import { OpenaiModule } from '../openai/openai.module';
import { HubspotModule } from '../hubspot/hubspot.module';

@Module({
  controllers: [CandidatesController],
  providers: [CandidatesService],
  imports: [forwardRef(() => HubspotModule),
    PrismaModule, GoogledriveModule, TextractModule, S3Module, OpenaiModule],
  exports: [CandidatesService],
})
export class CandidatesModule {}
