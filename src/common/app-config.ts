/**
 * Resolves the environment-shaped configuration that used to be inferred by
 * substring-matching a single `REDIS_BASE_KEY` string.
 *
 * That one variable simultaneously controlled the BullMQ prefix, the app key
 * prefix, whether queues ran at all (`includes('LOCAL')`), which Stripe
 * credentials were loaded (`includes('PROD')`), and the Stripe webhook
 * environment label. Renaming a namespace therefore silently changed
 * behaviour — including swapping test Stripe keys for live ones.
 *
 * Each of those concerns now has its own explicit variable:
 *
 *   APP_ENV          local | staging | production   (credentials + webhook label)
 *   QUEUES_ENABLED   true | false                   (BullMQ on/off)
 *   REDIS_KEY_PREFIX prefix for plain app keys, normalised to end with ':'
 *   BULLMQ_PREFIX    prefix for queue keys, normalised WITHOUT a trailing ':'
 *   INSTANCE_ID      distinguishes concurrent local devs (webhook label only)
 *
 * When the new variables are absent every resolver falls back to the legacy
 * `REDIS_BASE_KEY` behaviour, so already-deployed environments keep working
 * until their config is migrated. The fallbacks are deliberately bug-for-bug
 * faithful — see resolveWebhookServerLabel.
 */

export type AppEnv = 'local' | 'staging' | 'production';

/** Structural type satisfied by Nest's ConfigService and by test doubles. */
export interface ConfigLike {
  get<T = string>(key: string, defaultValue?: T): T | undefined;
}

type Reader = (key: string) => string | undefined;

const processEnvReader: Reader = (key) => process.env[key];

const configServiceReader =
  (config: ConfigLike): Reader =>
  (key) =>
    config.get<string>(key);

/** Trimmed value, or undefined when unset/blank — blank env vars are not values. */
function read(reader: Reader, key: string): string | undefined {
  const raw = reader(key);
  if (raw === undefined || raw === null) return undefined;
  const trimmed = String(raw).trim();
  return trimmed === '' ? undefined : trimmed;
}

// ---------------------------------------------------------------------------
// APP_ENV
// ---------------------------------------------------------------------------

const APP_ENV_VALUES: Record<string, AppEnv> = {
  local: 'local',
  development: 'local',
  dev: 'local',
  staging: 'staging',
  stage: 'staging',
  production: 'production',
  prod: 'production',
};

function resolveAppEnvWith(reader: Reader): AppEnv {
  const explicit = read(reader, 'APP_ENV');
  if (explicit) {
    const resolved = APP_ENV_VALUES[explicit.toLowerCase()];
    if (!resolved) {
      throw new Error(
        `Invalid APP_ENV "${explicit}". Expected one of: local, staging, production.`,
      );
    }
    return resolved;
  }

  // Legacy fallback: infer from REDIS_BASE_KEY substrings, preserving the
  // original precedence (LOCAL wins over STAGING wins over PROD).
  const legacy = (read(reader, 'REDIS_BASE_KEY') ?? '').toUpperCase();
  if (legacy.includes('LOCAL')) return 'local';
  if (legacy.includes('STAGING')) return 'staging';
  if (legacy.includes('PROD')) return 'production';
  return 'local';
}

export function appEnvSync(): AppEnv {
  return resolveAppEnvWith(processEnvReader);
}

export function appEnv(config: ConfigLike): AppEnv {
  return resolveAppEnvWith(configServiceReader(config));
}

export function isProduction(config: ConfigLike): boolean {
  return appEnv(config) === 'production';
}

// ---------------------------------------------------------------------------
// QUEUES_ENABLED
// ---------------------------------------------------------------------------

const TRUE_VALUES = new Set(['true', '1', 'yes', 'on', 'enabled']);
const FALSE_VALUES = new Set(['false', '0', 'no', 'off', 'disabled']);

function resolveQueuesEnabledWith(reader: Reader): boolean {
  const explicit = read(reader, 'QUEUES_ENABLED');
  if (explicit) {
    const normalised = explicit.toLowerCase();
    if (TRUE_VALUES.has(normalised)) return true;
    if (FALSE_VALUES.has(normalised)) return false;
    // This flag gates payment-related background work; a typo must not
    // silently resolve to "on".
    throw new Error(
      `Invalid QUEUES_ENABLED "${explicit}". Expected a boolean (true/false).`,
    );
  }

  // Legacy fallback: queues were disabled exactly when REDIS_BASE_KEY
  // contained "LOCAL", including the unset case resolving to enabled.
  return !(read(reader, 'REDIS_BASE_KEY') ?? '')
    .toUpperCase()
    .includes('LOCAL');
}

/**
 * True when BullMQ queues, workers and job scheduling should be active.
 *
 * Disabling this keeps local dev off the shared Redis instance: no queue or
 * worker connections are opened, no jobs are enqueued, and no recurring
 * schedules are registered.
 */
export function queuesEnabled(config: ConfigLike): boolean {
  return resolveQueuesEnabledWith(configServiceReader(config));
}

/**
 * Module-definition-time variant. Reads process.env directly, so it is safe to
 * call inside `@Module()` decorator bodies before Nest's DI has initialised.
 */
export function queuesEnabledSync(): boolean {
  return resolveQueuesEnabledWith(processEnvReader);
}

// ---------------------------------------------------------------------------
// Key prefixes
// ---------------------------------------------------------------------------

const DEFAULT_PREFIX = 'medvirtual';

/** Strips any trailing colons — the separator is applied by the caller. */
function stripTrailingColons(value: string): string {
  return value.replace(/:+$/, '');
}

/**
 * Prefix for plain application keys, always terminated with exactly one ':'.
 *
 * Callers concatenate directly (`${keyPrefix(config)}some_key`). Normalising
 * here fixes keys like "MEDVIRTUAL:STAGINGhubstaff_token_rotation", which a
 * base key without a trailing colon used to produce.
 */
function resolveKeyPrefixWith(reader: Reader): string {
  const value =
    read(reader, 'REDIS_KEY_PREFIX') ??
    read(reader, 'REDIS_BASE_KEY') ??
    DEFAULT_PREFIX;
  return `${stripTrailingColons(value)}:`;
}

export function keyPrefix(config: ConfigLike): string {
  return resolveKeyPrefixWith(configServiceReader(config));
}

export function keyPrefixSync(): string {
  return resolveKeyPrefixWith(processEnvReader);
}

/**
 * Prefix for BullMQ queue keys, without a trailing ':' — BullMQ inserts its
 * own separator when composing `<prefix>:<queue>:<key>`.
 */
function resolveBullPrefixWith(reader: Reader): string {
  const value =
    read(reader, 'BULLMQ_PREFIX') ??
    read(reader, 'REDIS_BASE_KEY') ??
    DEFAULT_PREFIX;
  return stripTrailingColons(value);
}

export function bullPrefix(config: ConfigLike): string {
  return resolveBullPrefixWith(configServiceReader(config));
}

export function bullPrefixSync(): string {
  return resolveBullPrefixWith(processEnvReader);
}

// ---------------------------------------------------------------------------
// Stripe webhook environment label
// ---------------------------------------------------------------------------

/**
 * Value stored as `metadata.server` on Stripe webhook endpoints, used to decide
 * which endpoints belong to this environment. Endpoints carrying this label
 * with a different URL get deleted, so the value must stay stable for an
 * environment and must never collide across environments.
 *
 * The legacy branch reproduces the original chain verbatim — including its
 * 'dev' default — so that environments which have not yet set APP_ENV keep
 * claiming exactly the endpoints they already own.
 */
function resolveWebhookServerLabelWith(reader: Reader): string {
  const explicitEnv = read(reader, 'APP_ENV');

  if (explicitEnv) {
    switch (resolveAppEnvWith(reader)) {
      case 'production':
        return 'prod';
      case 'staging':
        return 'staging';
      case 'local':
        // Each developer needs a distinct label, otherwise one dev's startup
        // deletes another's webhook endpoint.
        return `local:${
          read(reader, 'INSTANCE_ID') ??
          stripTrailingColons(resolveKeyPrefixWith(reader))
        }`;
    }
  }

  const legacy = read(reader, 'REDIS_BASE_KEY') ?? '';
  if (legacy.includes('LOCAL')) return legacy;
  if (legacy.includes('STAGING')) return 'staging';
  if (legacy.includes('PROD')) return 'prod';
  return 'dev';
}

export function webhookServerLabel(config: ConfigLike): string {
  return resolveWebhookServerLabelWith(configServiceReader(config));
}

// ---------------------------------------------------------------------------
// Startup diagnostics
// ---------------------------------------------------------------------------

/**
 * Human-readable summary of the resolved configuration, logged at startup so
 * that a misconfigured environment is visible immediately rather than after it
 * has already talked to live Stripe or drained a queue. Contains no secrets.
 */
export function describeAppConfig(config: ConfigLike): string {
  const usingLegacy =
    read(configServiceReader(config), 'APP_ENV') === undefined;
  const parts = [
    `env=${appEnv(config)}`,
    `queues=${queuesEnabled(config) ? 'enabled' : 'disabled'}`,
    `keyPrefix=${keyPrefix(config)}`,
    `bullPrefix=${bullPrefix(config)}`,
    `stripeKeys=${isProduction(config) ? 'aws-secrets-manager (LIVE)' : 'env vars'}`,
    `webhookServer=${webhookServerLabel(config)}`,
  ];
  if (usingLegacy) parts.push('source=REDIS_BASE_KEY (legacy fallback)');
  return parts.join('  ');
}
