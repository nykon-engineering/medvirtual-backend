import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HubstaffService } from './hubstaff.service';
import { HubstaffController } from './hubstaff.controller';
import { HubstaffWorker } from './hubstaff.worker';
import { SecretsModule } from '../secrets/secrets.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    SecretsModule,
    PrismaModule,
    BullModule.registerQueue({
      name: 'hubstaff-sync',
    }),
  ],
  controllers: [HubstaffController],
  providers: [HubstaffService, HubstaffWorker],
  exports: [HubstaffService, HubstaffWorker],
})
export class HubstaffModule {}

