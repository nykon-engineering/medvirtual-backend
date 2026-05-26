import { Module, Global } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { StripeController } from './stripe.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { InvoiceModule } from '../invoice/invoice.module';

@Global()
@Module({
  imports: [
    PrismaModule,
    // InvoiceModule already registers and exports all invoice-related queues.
    // Importing it here gives StripeService access to @InjectQueue('invoice')
    // and @InjectQueue('invoice-prebill-reconciliation') without opening
    // duplicate Redis connections.
    InvoiceModule,
  ],
  providers: [StripeService],
  controllers: [StripeController],
  exports: [StripeService],
})
export class StripeModule {}
