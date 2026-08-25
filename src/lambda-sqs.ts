import { SQSEvent } from 'aws-lambda';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DealsQueueConsumerService } from './sqs/deals-queue-consumer.service';
import { InvoiceWorker } from './invoice/invoice.worker';

let app;

async function bootstrap() {
  if (!app) {
    app = await NestFactory.createApplicationContext(AppModule);
  }
  return app;
}

export const handler = async (event: SQSEvent) => {
  const app = await bootstrap();
  const consumer = app.get(DealsQueueConsumerService);
  const invoiceWorker = app.get(InvoiceWorker);

  for (const record of event.Records) {
    let payload: any = JSON.parse(record.body);

    if (typeof payload === 'string') {
      payload = JSON.parse(payload);
    }

    const type = payload.Type?.trim();

    if (type === 'GENERATE_INVOICE') {
      console.log(
        `Generating invoice for org ${payload.organization_id} (Job: ${payload.job_id})`,
      );
      await invoiceWorker.process({ data: payload } as any);
      continue;
    }

    await consumer.handleMessage(record.body);
  }
};
