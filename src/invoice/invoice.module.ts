import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { InvoiceWorker } from './invoice.worker';
import { InvoiceStatsWorker } from './invoice-stats.worker';
import { InvoiceReconciliationWorker } from './invoice-reconciliation.worker';
import { InvoicePrebillReconciliationWorker } from './invoice-prebill-reconciliation.worker';
import { PrismaModule } from '../prisma/prisma.module';
import { PusherModule } from '../pusher/pusher.module';
import { HubstaffModule } from '../hubstaff/hubstaff.module';
import { MailModule } from '../mail/mail.module';
import { isLocalModeSync } from '../common/bull.utils';

const LOCAL = isLocalModeSync();

const workerProviders = LOCAL
  ? []
  : [InvoiceWorker, InvoiceStatsWorker, InvoiceReconciliationWorker, InvoicePrebillReconciliationWorker];

@Module({
  imports: [
    PrismaModule,
    PusherModule,
    HubstaffModule,
    MailModule,
    ...(LOCAL
      ? []
      : [
          BullModule.registerQueue(
            { name: 'invoice' },
            { name: 'invoice-stats' },
            { name: 'invoice-reconciliation' },
            { name: 'invoice-prebill-reconciliation' },
          ),
        ]),
  ],
  controllers: [InvoiceController],
  providers: [InvoiceService, ...workerProviders],
  exports: [InvoiceService, ...workerProviders],
})
export class InvoiceModule {}
