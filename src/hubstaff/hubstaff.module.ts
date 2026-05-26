import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HubstaffService } from './hubstaff.service';
import { HubstaffController } from './hubstaff.controller';
import { HubstaffWorker } from './hubstaff.worker';
import { SecretsModule } from '../secrets/secrets.module';
import { PrismaModule } from '../prisma/prisma.module';
import { HubspotModule } from '../hubspot/hubspot.module';
import { isLocalModeSync } from '../common/bull.utils';

const LOCAL = isLocalModeSync();

@Module({
  imports: [
    SecretsModule,
    PrismaModule,
    HubspotModule,
    ...(LOCAL
      ? []
      : [BullModule.registerQueue({ name: 'hubstaff-sync' })]),
  ],
  controllers: [HubstaffController],
  providers: [HubstaffService, ...(LOCAL ? [] : [HubstaffWorker])],
  exports: [HubstaffService, ...(LOCAL ? [] : [HubstaffWorker])],
})
export class HubstaffModule {}
