import { createHash } from 'crypto';

export function buildCommissionIdempotencyKey(params: {
  affiliateId: string;
  hubspotInvoiceId: string;
  paidAt: Date | null;
  baseAmount: string;
  commissionPercent: string;
}): string {
  const payload = [
    params.affiliateId,
    params.hubspotInvoiceId,
    params.paidAt ? params.paidAt.toISOString() : '',
    params.baseAmount,
    params.commissionPercent,
  ].join('|');

  return createHash('sha256').update(payload).digest('hex');
}
