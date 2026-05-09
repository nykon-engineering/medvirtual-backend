import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { InvoiceWorker } from './invoice.worker';
import { PrismaModule } from '../prisma/prisma.module';
import { PusherModule } from '../pusher/pusher.module';
import { HubstaffModule } from '../hubstaff/hubstaff.module';

@Module({
  imports: [
    PrismaModule,
    PusherModule,
    HubstaffModule,
    BullModule.registerQueue({
      name: 'invoice',
    }),
  ],
  controllers: [InvoiceController],
  providers: [InvoiceService, InvoiceWorker],
  exports: [InvoiceService, InvoiceWorker],
})
export class InvoiceModule {}
