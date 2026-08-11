import { Module, Global, forwardRef } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { StripeController } from './stripe.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { BullModule } from '@nestjs/bullmq';
import { isLocalModeSync } from '../common/bull.utils';

@Global()
@Module({
  imports: [
    PrismaModule,
    forwardRef(() => InvoiceModule),
    ...(isLocalModeSync()
      ? []
      : [
          BullModule.registerQueue(
            { name: 'invoice' },
            { name: 'invoice-prebill-reconciliation' },
          ),
        ]),
  ],
  providers: [StripeService],
  controllers: [StripeController],
  exports: [StripeService],
})
export class StripeModule {}

