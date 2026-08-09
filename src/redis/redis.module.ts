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

        // BullMQ requires noeviction policy to prevent job loss
        try {
          const config = await client.configGet('maxmemory-policy');
          if (config && config['maxmemory-policy'] !== 'noeviction') {
            console.error(`\n\x1b[31m[CRITICAL] Redis eviction policy is "${config['maxmemory-policy']}".\x1b[0m`);
            console.error(`\x1b[31m[CRITICAL] BullMQ REQUIRES "noeviction" to prevent data loss. Please update your Redis config.\x1b[0m\n`);
          }
        } catch (err) {
          console.warn('Could not verify Redis eviction policy. Ensure it is set to "noeviction" for BullMQ.');
        }

        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}
