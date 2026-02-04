import { SQSEvent } from 'aws-lambda';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HandlerDealCreation } from './hubspot/handlers/dealCreation';
import { PrismaService } from './prisma/prisma.service';

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
  const prisma = app.get(PrismaService);

  for (const record of event.Records) {
    //console.log('Processing record:', record.body);
    const payload = JSON.parse(record.body);
    switch (payload.Type) {
      case 'CREATE_DEAL_STAFF':
        //Process deal creation
        await dealService.execute(payload);
        break;

      case 'DEACTIVATE_STAFF':
        console.log(`Deactivating staff for deal ${payload.objectId}`);
        // Process deactivation
        await prisma.staff.update({
          where: { hubspot_id: String(payload.objectId) },
          data: { status: 'terminated' },
        })
        break;

      case 'REACTIVATE_STAFF':
        console.log(`Reactivating staff for deal ${payload.objectId}`);
        // Process reactivation
        await prisma.staff.update({
          where: { hubspot_id: String(payload.objectId) },
          data: { status: 'active' },
        })
        break;
      default:
        console.warn('Event not handled:', payload);
        break;
      
    }
    
    
  }
};
