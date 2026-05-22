import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { rawBody: true });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;

  await app.enableCors({
    origin: [
      'https://app.medvirtual.ai',
      'https://staging.medvirtual.ai',
      'http://localhost:3001',
      'http://localhost:3000',
      'http://localhost:9000',
      'https://med-alliance.d2odvfjc5yqdaj.amplifyapp.com',
      'https://med-alliance-improved.d2odvfjc5yqdaj.amplifyapp.com',
      'https://mv.staging.nykon.cloud',
      'https://mv-api.staging.nykon.cloud'
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
  }));

  const server = app.getHttpServer();
  server.setTimeout(20 * 60 * 1000); // 20 min

  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
