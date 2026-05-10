import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { InvoiceWorker } from './invoice.worker';
import { InvoiceStatsWorker } from './invoice-stats.worker';
import { PrismaModule } from '../prisma/prisma.module';
import { PusherModule } from '../pusher/pusher.module';
import { HubstaffModule } from '../hubstaff/hubstaff.module';

@Module({
  imports: [
    PrismaModule,
    PusherModule,
    HubstaffModule,
    BullModule.registerQueue(
      { name: 'invoice' },
      { name: 'invoice-stats' }
    ),
  ],
  controllers: [InvoiceController],
  providers: [InvoiceService, InvoiceWorker, InvoiceStatsWorker],
  exports: [InvoiceService, InvoiceWorker, InvoiceStatsWorker],
})
export class InvoiceModule {}
