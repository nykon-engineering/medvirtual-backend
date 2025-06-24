// lambda.ts
import { Handler } from 'aws-lambda';
import { createServer, proxy } from 'aws-serverless-express';
import { AppModule } from './app.module';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';

let cachedServer;

async function bootstrapServer(): Promise<any> {
  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
  await app.init();
  return createServer(expressApp);
}

export const handler: Handler = async (event, context) => {
  console.log('Lambda invoked');
  console.log('Event:', JSON.stringify(event));
  if (!cachedServer) {
    console.log('Creating new server instance...');
    cachedServer = await bootstrapServer();
  }
  return proxy(cachedServer, event, context, 'PROMISE').promise;
};
