// lambda.ts
import { Handler } from 'aws-lambda';
import { createServer, proxy } from 'aws-serverless-express';
import { AppModule } from './app.module';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

let cachedServer;

async function bootstrapServer(): Promise<any> {
  const expressApp = express();
  expressApp.use(express.json());
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
  
  await app.enableCors({
    origin: ['https://app.medvirtual.ai','https://staging.medvirtual.ai','http://localhost:3001','http://localhost:3000'], 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', 
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
  });

  await app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, 
      forbidNonWhitelisted: false, 
      transform: true,
    }),
  );

  //Inicialize the Swagger configuration
  const config = new DocumentBuilder()
  .setTitle('MedVirtual Backend')
  .setDescription('API documentation for our backend application developed in  NestJS')
  .setVersion('1.0')
  .addServer('/dev')
  .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('documentation', app, document);

  await app.init();

  return createServer(expressApp);
}



export const handler: Handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': event.headers.origin || 'https://staging.medvirtual.ai',
        'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: '',
    };
  }

  if (!cachedServer) {
    console.log('Creating new server instance...');
    cachedServer = await bootstrapServer();
  }
  return proxy(cachedServer, event, context, 'PROMISE').promise;
};
