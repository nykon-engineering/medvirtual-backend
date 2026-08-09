/**
 * Error predicates for deciding whether an OpenAI failure should engage the
 * OpenRouter fallback.
 *
 * The OpenAI Node SDK v5 throws `APIError` objects that expose `status` and
 * `code` at the top level, with the provider's own type nested under
 * `error.error.type`. Earlier code in this repo checked only `error.type`,
 * which is undefined on those objects — so quota detection was unreliable and
 * the rate-limit branch never matched (`rate_limit_error` is an Anthropic type
 * string, not an OpenAI one). These helpers read every shape defensively so the
 * fallback triggers on real quota exhaustion and nothing else.
 */

const QUOTA_CODES = ['insufficient_quota', 'billing_hard_limit_reached'];
const RATE_LIMIT_CODES = ['rate_limit_exceeded', 'rate_limit'];

/** Statuses OpenAI uses for a key that is out of credit. */
const QUOTA_STATUSES = [401, 403, 429];

function readStatus(err: any): number | undefined {
  return err?.status ?? err?.statusCode ?? err?.response?.status;
}

function readCode(err: any): string | undefined {
  return err?.code ?? err?.error?.code ?? err?.response?.data?.error?.code;
}

function readType(err: any): string | undefined {
  return err?.type ?? err?.error?.type ?? err?.response?.data?.error?.type;
}

function readMessage(err: any): string {
  return String(
    err?.message ??
      err?.error?.message ??
      err?.response?.data?.error?.message ??
      '',
  );
}

/**
 * True only when the account is out of credit. A plain 429 rate limit and any
 * 5xx must return false — those are transient and are rethrown rather than
 * silently downgraded to a free model.
 */
export function isInsufficientQuotaError(err: any): boolean {
  if (!err) return false;

  const status = readStatus(err);
  const code = readCode(err);
  const type = readType(err);

  const quotaCoded =
    QUOTA_CODES.includes(code as string) ||
    QUOTA_CODES.includes(type as string);

  if (quotaCoded) {
    // Some SDK paths surface the code without any status attached.
    return status === undefined || QUOTA_STATUSES.includes(status);
  }

  // An explicitly rate-limit-coded error is throttling, never quota.
  if (
    RATE_LIMIT_CODES.includes(code as string) ||
    RATE_LIMIT_CODES.includes(type as string)
  ) {
    return false;
  }

  // Last resort: OpenAI's billing copy, guarded by a plausible status so an
  // unrelated message mentioning "billing" cannot trigger the fallback.
  if (
    /exceeded your current quota|check your plan and billing/i.test(
      readMessage(err),
    )
  ) {
    return status === undefined || QUOTA_STATUSES.includes(status);
  }

  return false;
}

/**
 * True for throttling. Callers rethrow these unchanged — the fallback is
 * deliberately scoped to quota exhaustion only.
 */
export function isRateLimitError(err: any): boolean {
  if (!err) return false;

  const code = readCode(err);
  const type = readType(err);

  if (
    RATE_LIMIT_CODES.includes(code as string) ||
    RATE_LIMIT_CODES.includes(type as string)
  ) {
    return true;
  }

  // A 429 that is not quota-coded is a rate limit.
  const status = readStatus(err);
  if (status === 429) {
    const quotaCoded =
      QUOTA_CODES.includes(code as string) ||
      QUOTA_CODES.includes(type as string);
    return !quotaCoded;
  }

  return false;
}
