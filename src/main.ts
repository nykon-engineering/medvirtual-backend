import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const server = app.getHttpServer();
  server.setTimeout(20 * 60 * 1000); // 10 min

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
