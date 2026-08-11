/**
 * Advertised offer-panel / talent-pool promo price, monthly USD.
 *
 * MUST stay in sync with the frontend's `TALENT_POOL_PROMO_PRICE`
 * (frontend/src/app/modules/_shared/lib/public-talent-pool-brand.ts). The frontend
 * owns the rendered price — offer panels store only a `promo_enabled` flag, and the
 * struck-through original is recomputed live from the candidate's current bill rate.
 *
 * This backend copy exists solely so that accepting a promo panel can write a
 * human-readable ticket description and audit metadata. If one changes, change both.
 */
export const OFFER_PANEL_PROMO_PRICE_MONTHLY = 1760;

/** "$1,760" — derived from the number so the label can never drift from it. */
export const OFFER_PANEL_PROMO_PRICE_LABEL = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
}).format(OFFER_PANEL_PROMO_PRICE_MONTHLY);

/**
 * Audit/metadata payload describing the promo state of a panel at the moment of an
 * event. Returns an empty object when the promo is off, so it can be spread into a
 * metadata literal unconditionally without emitting `promoEnabled: false` noise.
 */
export function offerPanelPromoMetadata(
  promoEnabled: boolean | null | undefined,
): { promoEnabled: true; promoPriceMonthly: number } | Record<string, never> {
  return promoEnabled
    ? {
        promoEnabled: true,
        promoPriceMonthly: OFFER_PANEL_PROMO_PRICE_MONTHLY,
      }
    : {};
}
