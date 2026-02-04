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
    console.log('Processing record:', record.body);
    const payload = JSON.parse(record.body);
    switch (payload.type) {
      case 'CREATE_DEAL_STAFF':
        // Process deal creation
        //await dealService.execute(payload);
        break;

      case 'DEACTIVATE_DEAL_STAFF':
        // Process deal creation
        break;

      case 'REACTIVATE_DEAL_STAFF':
        // Process deal creation
        break;
      
    }
    
    
  }
};
