import { Module, Global } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { StripeController } from './stripe.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { InvoiceModule } from '../invoice/invoice.module';

@Global()
@Module({
  imports: [
    PrismaModule,
    // InvoiceModule exports the BullMQ queue tokens for 'invoice' and
    // 'invoice-prebill-reconciliation', so StripeService can inject them
    // via @InjectQueue without re-registering (no duplicate connections).
    // No circular dependency: StripeModule is @Global, so InvoiceModule
    // accesses StripeService via global DI without importing StripeModule.
    InvoiceModule,
  ],
  providers: [StripeService],
  controllers: [StripeController],
  exports: [StripeService],
})
export class StripeModule {}

