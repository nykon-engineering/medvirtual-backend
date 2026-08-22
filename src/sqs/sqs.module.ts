import { Module } from '@nestjs/common';
import { SqsService } from './sqs.service';
import { DealsQueueConsumerService } from './deals-queue-consumer.service';
import { HubspotModule } from '../hubspot/hubspot.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [HubspotModule, PrismaModule],
  providers: [SqsService, DealsQueueConsumerService],
  exports: [SqsService, DealsQueueConsumerService],
})
export class SqsModule {}
