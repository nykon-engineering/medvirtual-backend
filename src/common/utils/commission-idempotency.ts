import { createHash } from 'crypto';

export function buildCommissionIdempotencyKey(params: {
  affiliateId: string;
  hubspotInvoiceId: string;
}): string {
  const payload = [params.affiliateId, params.hubspotInvoiceId].join('|');

  return createHash('sha256').update(payload).digest('hex');
}
