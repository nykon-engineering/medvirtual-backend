import { Module } from '@nestjs/common';
import { CronController } from './cron.controller';
import { CronService } from './cron.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CandidatesModule } from '../candidate/candidates.module';
import { HubspotModule } from '../hubspot/hubspot.module';

@Module({
  controllers: [CronController],
  providers: [CronService],
  imports:[PrismaModule, CandidatesModule, HubspotModule]
})
export class CronModule {}
