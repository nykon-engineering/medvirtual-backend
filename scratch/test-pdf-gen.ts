import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { InvoiceService } from '../src/invoice/invoice.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function run() {
  console.log('Bootstrapping NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  console.log('Context bootstrapped successfully.');

  const prisma = app.get(PrismaService);
  const invoiceService = app.get(InvoiceService);

  // Find an invoice to use
  let invoiceId = process.argv[2];
  if (!invoiceId) {
    console.log('No invoice ID provided. Querying the database for the latest invoice...');
    const latestInvoice = await prisma.invoice.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    if (!latestInvoice) {
      console.error('No invoices found in the database. Please create an invoice first or pass an ID.');
      await app.close();
      process.exit(1);
    }
    invoiceId = latestInvoice.id;
    console.log(`Found latest invoice: ID=${invoiceId}, Reference=${latestInvoice.reference}`);
  } else {
    console.log(`Using provided invoice ID: ${invoiceId}`);
  }

  try {
    console.log(`Starting PDF generation for invoice: ${invoiceId}...`);
    const path = await invoiceService.generateInvoicePdf(invoiceId);
    console.log(`PDF generation complete. Saved to: ${path}`);
  } catch (error) {
    console.error('Error occurred during PDF generation:', error);
  } finally {
    await app.close();
    console.log('Application context closed.');
  }
}

run().catch((err) => {
  console.error('Fatal error running script:', err);
  process.exit(1);
});
