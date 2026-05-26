import { Module, Global } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { StripeController } from './stripe.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';
import { isLocalModeSync } from '../common/bull.utils';

@Global()
@Module({
  imports: [
    PrismaModule,
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

