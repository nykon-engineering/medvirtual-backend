import { Module } from '@nestjs/common';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { InvoiceWorker } from './invoice.worker';
import { InvoiceStatsWorker } from './invoice-stats.worker';
import { InvoiceReconciliationWorker } from './invoice-reconciliation.worker';
import { InvoicePrebillReconciliationWorker } from './invoice-prebill-reconciliation.worker';
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
      { name: 'invoice-stats' },
      { name: 'invoice-reconciliation' },
      { name: 'invoice-prebill-reconciliation' },
    ),
  ],
  controllers: [InvoiceController],
  providers: [InvoiceService, InvoiceWorker, InvoiceStatsWorker, InvoiceReconciliationWorker, InvoicePrebillReconciliationWorker],
  exports: [
    InvoiceService,
    InvoiceWorker,
    InvoiceStatsWorker,
    InvoiceReconciliationWorker,
    InvoicePrebillReconciliationWorker,
    // Export queue tokens so modules importing InvoiceModule can inject
    // these queues without re-registering them (avoids duplicate connections)
    getQueueToken('invoice'),
    getQueueToken('invoice-prebill-reconciliation'),
  ],
})
export class InvoiceModule {}
