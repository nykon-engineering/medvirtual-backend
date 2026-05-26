/**
 * Returns true when the app is running in local-development mode.
 *
 * Convention: set REDIS_BASE_KEY to a string that contains "LOCAL"
 * (e.g. "LOCAL_medvirtual") in your local .env to signal this.
 *
 * When local mode is active:
 *  – BullModule is not imported at all (no Redis connections for queues/workers)
 *  – No jobs are enqueued, no recurring schedules are registered
 *  – Workers' process() methods guard with an early return as a belt-and-suspenders
 *
 * This prevents local dev instances from consuming Redis connection slots on
 * the shared remote Redis instance and from accidentally mutating production data.
 */

/** Use inside NestJS services/workers (ConfigService is available). */
export function isLocalMode(baseKey: string): boolean {
  return baseKey.toUpperCase().includes('LOCAL');
}

/**
 * Use at module-definition time (before NestJS DI initialises).
 * Reads process.env directly — safe to call in @Module() decorator bodies.
 */
export function isLocalModeSync(): boolean {
  return (process.env.REDIS_BASE_KEY ?? '').toUpperCase().includes('LOCAL');
}
