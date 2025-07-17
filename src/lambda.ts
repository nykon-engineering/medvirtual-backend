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
  await app.enableCors();

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

  if (!cachedServer) {
    console.log('Creating new server instance...');
    cachedServer = await bootstrapServer();
  }
  return proxy(cachedServer, event, context, 'PROMISE').promise;
};
