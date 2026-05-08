import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as redis from 'redis';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: async (configService: ConfigService) => {
        const client = redis.createClient({
          password: configService.get<string>('REDIS_PASSWORD'),
          username: configService.get<string>('REDIS_USERNAME', 'basic'),
          socket: {
            host: configService.get<string>('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379),
          },
        });
        client.on('error', (err) => console.error('Redis Client Error =>', err));
        client.on('connect', () =>
          console.info('Redis Client connected', `${configService.get('REDIS_HOST', 'localhost')}`),
        );
        await client.connect();
        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}
