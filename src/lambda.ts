// lambda.ts
import { Handler } from 'aws-lambda';
import { createServer, proxy } from 'aws-serverless-express';
import { AppModule } from './app.module';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

let cachedServer;

async function bootstrapServer(): Promise<any> {
  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
  await app.enableCors();

  //Inicialize the Swagger configuration
  const config = new DocumentBuilder()
  .setTitle('My API documentation')
  .setDescription('API documentation for our backend application developed in  NestJS')
  .setVersion('1.0')
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
