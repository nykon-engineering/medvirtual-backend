import { SQSEvent } from 'aws-lambda';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HandlerDealCreation } from './hubspot/handlers/dealCreation';

let app;

async function bootstrap() {
  if (!app) {
    app = await NestFactory.createApplicationContext(AppModule);
  }
  return app;
}

export const handler = async (event: SQSEvent) => {
  const app = await bootstrap();
  const dealService = app.get(HandlerDealCreation);

  for (const record of event.Records) {
    const payload = JSON.parse(record.body);
    await dealService.execute(payload);
  }
};
