import { Module, Global } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { StripeController } from './stripe.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';

@Global()
@Module({
  imports: [
    PrismaModule,
    // Registering queues here is safe — BullModule.forRootAsync in AppModule
    // provides a shared IORedis instance, so these registrations reuse that
    // connection instead of opening new ones.
    BullModule.registerQueue(
      { name: 'invoice' },
      { name: 'invoice-prebill-reconciliation' },
    ),
  ],
  providers: [StripeService],
  controllers: [StripeController],
  exports: [StripeService],
})
export class StripeModule {}
