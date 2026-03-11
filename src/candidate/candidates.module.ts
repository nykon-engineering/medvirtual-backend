import { forwardRef, Module } from '@nestjs/common';
import { CandidatesService } from './candidates.service';
import { CandidatesController } from './candidates.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { GoogledriveModule } from '../googledrive/googledrive.module';
import { S3Module } from '../s3/s3.module';
import { OpenaiModule } from '../openai/openai.module';
import { HubspotModule } from '../hubspot/hubspot.module';
import { MailModule } from '../mail/mail.module';
import { HireRequestModule } from '../hire-request/hire-request.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PositionRateConfigModule } from '../position-rate-config/position-rate-config.module';

@Module({
  controllers: [CandidatesController],
  providers: [CandidatesService],
  imports: [forwardRef(() => HubspotModule),
    PrismaModule, GoogledriveModule, S3Module, OpenaiModule, MailModule, HireRequestModule, NotificationsModule, PositionRateConfigModule],
  exports: [CandidatesService],
})
export class CandidatesModule {}
