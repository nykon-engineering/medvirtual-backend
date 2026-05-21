import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HubstaffService } from './hubstaff.service';
import { HubstaffController } from './hubstaff.controller';
import { HubstaffWorker } from './hubstaff.worker';
import { SecretsModule } from '../secrets/secrets.module';
import { PrismaModule } from '../prisma/prisma.module';
import { HubspotModule } from '../hubspot/hubspot.module';

@Module({
  imports: [
    SecretsModule,
    PrismaModule,
    HubspotModule,
    BullModule.registerQueue({
      name: 'hubstaff-sync',
    }),
  ],
  controllers: [HubstaffController],
  providers: [HubstaffService, HubstaffWorker],
  exports: [HubstaffService, HubstaffWorker],
})
export class HubstaffModule {}

