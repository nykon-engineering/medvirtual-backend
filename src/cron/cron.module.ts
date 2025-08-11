import { Module } from '@nestjs/common';
import { CronController } from './cron.controller';
import { CronService } from './cron.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CandidatesModule } from '../candidate/candidates.module';

@Module({
  controllers: [CronController],
  providers: [CronService],
  imports:[PrismaModule, CandidatesModule]
})
export class CronModule {}
