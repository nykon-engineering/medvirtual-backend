import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as redis from 'redis';

/**
 * Module-scoped handle on the live client. The provider factory runs once per
 * Nest application instance, but a process can create several of those (HMR,
 * `nest start --watch`, Jest suites, a failed bootstrap that gets retried).
 * Without this handle each run would leak a connected socket until Redis hit
 * its client limit.
 */
let activeClient: redis.RedisClientType | null = null;
let signalHandlersRegistered = false;

/**
 * Best-effort graceful shutdown. `close()` waits for in-flight commands to
 * drain, but that never resolves if the socket is already broken, so fall back
 * to `destroy()` (immediate, no round trip) after a short grace period.
 */
async function closeClient(client: redis.RedisClientType): Promise<void> {
  if (!client.isOpen) return;

  try {
    await Promise.race([
      client.close(),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('Redis close() timed out')), 2000),
      ),
    ]);
  } catch (err) {
    console.warn(
      'Redis graceful close failed, forcing disconnect =>',
      err instanceof Error ? err.message : err,
    );
    try {
      client.destroy();
    } catch {
      // Already gone — nothing left to release.
    }
  }
}

/** Closes the previous client (if any) so we never stack connections. */
async function killActiveClient(): Promise<void> {
  if (!activeClient) return;

  const previous = activeClient;
  activeClient = null;
  console.info(
    'Redis Client: closing existing connection before creating a new one',
  );
  await closeClient(previous);
}

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: async (configService: ConfigService) => {
        // Kill whatever is still connected from a previous bootstrap first.
        await killActiveClient();

        const client = redis.createClient({
          password: configService.get<string>('REDIS_PASSWORD'),
          username: configService.get<string>('REDIS_USERNAME', 'basic'),
          socket: {
            host: configService.get<string>('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379),
          },
        }) as redis.RedisClientType;

        client.on('error', (err) =>
          console.error('Redis Client Error =>', err),
        );
        client.on('connect', () =>
          console.info(
            'Redis Client connected',
            `${configService.get('REDIS_HOST', 'localhost')}`,
          ),
        );
        await client.connect();
        activeClient = client;

        // Registered once per process: re-adding these on every factory run
        // would itself leak listeners and trip MaxListenersExceededWarning.
        if (!signalHandlersRegistered) {
          signalHandlersRegistered = true;
          for (const signal of ['SIGTERM', 'SIGINT'] as const) {
            process.once(signal, () => {
              void killActiveClient();
            });
          }
        }

        // BullMQ requires noeviction policy to prevent job loss
        try {
          const config = await client.configGet('maxmemory-policy');
          if (config && config['maxmemory-policy'] !== 'noeviction') {
            console.error(
              `\n\x1b[31m[CRITICAL] Redis eviction policy is "${config['maxmemory-policy']}".\x1b[0m`,
            );
            console.error(
              `\x1b[31m[CRITICAL] BullMQ REQUIRES "noeviction" to prevent data loss. Please update your Redis config.\x1b[0m\n`,
            );
          }
        } catch {
          console.warn(
            'Could not verify Redis eviction policy. Ensure it is set to "noeviction" for BullMQ.',
          );
        }

        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(
    @Inject('REDIS_CLIENT') private readonly client: redis.RedisClientType,
  ) {}

  /** Requires `app.enableShutdownHooks()` in main.ts to fire. */
  async onApplicationShutdown(): Promise<void> {
    if (activeClient === this.client) {
      await killActiveClient();
    } else {
      await closeClient(this.client);
    }
  }
}
