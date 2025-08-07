import { Module } from '@nestjs/common';
import { CronController } from './cron.controller';
import { CronService } from './cron.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [CronController],
  providers: [CronService],
  imports:[PrismaModule]
})
export class CronModule {}
