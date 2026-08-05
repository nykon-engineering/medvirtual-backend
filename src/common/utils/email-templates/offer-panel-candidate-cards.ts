import { OFFER_PANEL_PROMO_PRICE_MONTHLY } from '../../constant/offer-panel-promo.constant';
import { escapeEmailHtml as esc } from './escape';
import { EmailTheme } from './theme';

/**
 * Renders the selected candidates as HTML cards for the offer-panel creation
 * email, mirroring the public talent-pool card.
 *
 * ── Why this is pre-rendered into a single placeholder ──────────────────────
 * The email template engine (`EmailTemplatesService.applyPlaceholders`) is a
 * hand-rolled `/\{\{[^}]+\}\}/g` replace — it has no loop or conditional
 * construct, so "for each candidate, draw a card" cannot be expressed in the
 * editable template body. The whole grid is therefore built here and injected
 * as the value of one `{{candidateCards}}` placeholder.
 *
 * Two consequences of that injection point, both load-bearing:
 *
 *  1. The output MUST NOT contain a newline. `renderHtml` runs
 *     `filledBody.replace(/\n/g, '<br>')` on the entire body AFTER placeholder
 *     substitution, so any newline in this markup becomes a stray <br> between
 *     cards. `stripNewlines` enforces this at the boundary.
 *
 *  2. Placeholder values are injected RAW (no escaping). Candidate names,
 *     countries and positions originate from HubSpot, so every interpolated
 *     value goes through `esc()`.
 *
 * ── Why nothing here branches on a business unit ────────────────────────────
 * Colour, logo and company name arrive in the `EmailTheme` that
 * `getBusinessUnitEmailTheme` resolves from the `EmailBranding` row for the
 * panel's BU. There are already three BUs (MedVirtual, Berry Virtual, MMVA) and
 * more can be added to that table at any time, so a hardcoded brand check would
 * be wrong on the day it was written. Everything the card needs beyond those
 * fields is derived from `primaryColor`.
 */

/** Card layout is fixed-width per email conventions; keeps Outlook predictable. */
const AVATAR_PX = 72;

/** Beyond this, the email risks Gmail's ~102KB clipping threshold. */
const MAX_CARDS = 6;

/** Skills shown before collapsing into a "+N" pill (no JS to measure overflow). */
const MAX_SKILL_PILLS = 2;

export interface OfferPanelEmailCandidate {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  country?: string | null;
  avatar_url?: string | null;
  employment_type?: string | null;
  approved_positions_pairing?: string[] | null;
  skills?: { skill_name?: string | null }[] | null;
  languages?: { name?: string | null }[] | null;
  bill_rate_monthly?: number | string | null;
  bill_rate_hourly?: number | string | null;
}

// ─── Colour derivation ───────────────────────────────────────────────────────
// `EmailBranding` stores a primary colour but no light tint: `accentColor` is a
// copy of `primary_color` and `secondaryColor` is a hardcoded grey. The card's
// pill and panel backgrounds are therefore mixed from the primary toward white,
// which reproduces the hand-authored design tokens rather than approximating
// them (mixing #FD7171 at 0.88 yields exactly the #ffeeee used by Berry).

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = (hex || '').trim().replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Mixes `hex` toward white by `amount` (0–1). Falls back to a neutral tint. */
export function mixWithWhite(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#f5f5f5';
  const m = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${m(rgb.r)}, ${m(rgb.g)}, ${m(rgb.b)})`;
}

export function rgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(0, 0, 0, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * Relative luminance test (WCAG). Decides whether text on the brand colour must
 * be white — assuming white would produce white-on-light for any pale BU colour
 * added to the branding table later.
 */
export function isDarkColor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
  return L < 0.45;
}

interface CardTheme {
  primary: string;
  onPrimary: string;
  logoUrl: string | null;
  pillBg: string;
  pillText: string;
  pillBorder: string;
  panelBg: string;
}

function toCardTheme(theme: EmailTheme): CardTheme {
  const primary = theme?.primaryColor || '#01546B';
  return {
    primary,
    onPrimary: isDarkColor(primary) ? '#ffffff' : '#1a1a19',
    logoUrl: theme?.logoUrl ?? null,
    pillBg: mixWithWhite(primary, 0.88),
    pillText: primary,
    pillBorder: rgba(primary, 0.22),
    panelBg: mixWithWhite(primary, 0.94),
  };
}

// ─── Value formatting ────────────────────────────────────────────────────────

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * "Ana Silva" -> "Ana S.". The email goes to clients and prospects and can be
 * forwarded anywhere, so it uses the masked form the platform already applies
 * to every non-system viewer (frontend `handleNameToDisplay`).
 */
export function maskCandidateName(c: OfferPanelEmailCandidate): string {
  const first = (c.first_name ?? '').trim();
  const last = (c.last_name ?? '').trim();

  if (first || last) {
    const initial = last ? ` ${last.charAt(0).toUpperCase()}.` : '';
    return `${first}${initial}`.trim();
  }

  // Fall back to the denormalized `name` column, masking its last token too.
  const parts = (c.name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Candidate';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(' ')} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

function initialsOf(c: OfferPanelEmailCandidate): string {
  const masked = maskCandidateName(c);
  const parts = masked.split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase());
  return letters.join('') || '?';
}

/** Collapses whitespace/newlines so the injected value survives renderHtml. */
function stripNewlines(html: string): string {
  return html.replace(/\s*\n\s*/g, '');
}

// ─── Fragments ───────────────────────────────────────────────────────────────

function pill(label: string, bg: string, color: string, border: string): string {
  return `<span style="display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:500;background:${bg};color:${color};border:1px solid ${border};line-height:16px;mso-line-height-rule:exactly;white-space:nowrap;">${esc(label)}</span>`;
}

/**
 * Pure-CSS initials tile. `showAvatar()` on the frontend falls back to
 * root-relative paths (`/avatar_default.png`) which resolve against the mail
 * client's own origin and break in every inbox, so the email never emits a
 * relative src — when there is no S3 avatar it draws this instead.
 */
function initialsTile(c: OfferPanelEmailCandidate, t: CardTheme): string {
  return `<div style="width:${AVATAR_PX}px;height:${AVATAR_PX}px;border-radius:${AVATAR_PX / 2}px;background:#ffffff;border:2px solid #ffffff;color:${t.primary};font-size:24px;font-weight:700;text-align:center;line-height:${AVATAR_PX}px;mso-line-height-rule:exactly;">${esc(initialsOf(c))}</div>`;
}

function avatar(c: OfferPanelEmailCandidate, t: CardTheme): string {
  const url = (c.avatar_url ?? '').trim();
  // Only absolute URLs are usable in an inbox.
  if (!/^https?:\/\//i.test(url)) return initialsTile(c, t);

  return `<img src="${esc(url)}" alt="${esc(maskCandidateName(c))}" width="${AVATAR_PX}" height="${AVATAR_PX}" style="width:${AVATAR_PX}px;height:${AVATAR_PX}px;border-radius:${AVATAR_PX / 2}px;object-fit:cover;object-position:center top;display:block;border:2px solid #ffffff;background:#fafafa;" />`;
}

function caption(text: string): string {
  return `<div style="font-size:9px;letter-spacing:.4px;text-transform:uppercase;color:#888780;font-weight:600;padding-bottom:6px;">${esc(text)}</div>`;
}

function rateBlock(c: OfferPanelEmailCandidate, promoEnabled: boolean): string {
  const monthly =
    toNumber(c.bill_rate_monthly) ??
    (toNumber(c.bill_rate_hourly) !== null
      ? (toNumber(c.bill_rate_hourly) as number) * 176
      : null);

  if (monthly === null || monthly <= 0) return '';

  // A promo must never present as a price increase, so the original is struck
  // only when it is actually above the advertised price.
  const showPromo = promoEnabled && monthly > OFFER_PANEL_PROMO_PRICE_MONTHLY;

  const amount = showPromo
    ? `<span style="display:block;font-size:12px;line-height:15px;color:#94a3b8;text-decoration:line-through;font-weight:600;">${usd.format(monthly)}</span><span style="font-size:18px;font-weight:600;color:#1a1a19;letter-spacing:-0.3px;">${usd.format(OFFER_PANEL_PROMO_PRICE_MONTHLY)}</span>`
    : `<span style="font-size:18px;font-weight:600;color:#1a1a19;letter-spacing:-0.3px;">${usd.format(monthly)}</span>`;

  return `${amount}<span style="font-size:11px;font-weight:400;color:#5f5e5a;">/mo</span>`;
}

function card(
  c: OfferPanelEmailCandidate,
  t: CardTheme,
  promoEnabled: boolean,
): string {
  const positions = (c.approved_positions_pairing ?? []).filter(Boolean);
  const skills = (c.skills ?? [])
    .map((s) => (s?.skill_name ?? '').trim())
    .filter(Boolean);

  const positionPills = positions
    .map((p) => pill(p, t.pillBg, t.pillText, t.pillBorder))
    .join(' ');

  const shownSkills = skills.slice(0, MAX_SKILL_PILLS);
  const hiddenSkills = skills.length - shownSkills.length;
  const skillPills =
    shownSkills
      .map((s) => pill(s, '#eaf3de', '#27500a', 'rgba(39,80,10,.14)'))
      .join(' ') +
    (hiddenSkills > 0
      ? ` ${pill(`+${hiddenSkills}`, '#f1efe8', '#5f5e5a', 'rgba(0,0,0,.06)')}`
      : '');

  const country = (c.country ?? '').trim();
  const employment = (c.employment_type ?? '').trim();
  const rate = rateBlock(c, promoEnabled);

  // The BU logo sits behind the identity block as a watermark. Outlook desktop
  // ignores background-image on a <td> and falls back to the flat panelBg
  // beneath it, so the block degrades to a clean tinted panel — never broken.
  const watermark = t.logoUrl
    ? `background-image:url('${esc(t.logoUrl)}');background-repeat:no-repeat;background-position:right 14px center;background-size:132px auto;`
    : '';

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;background:#ffffff;border:1px solid #ebebeb;border-radius:12px;margin-bottom:14px;">
      <tr>
        <td style="padding:18px 18px 16px;border-radius:12px 12px 0 0;background-color:${t.panelBg};${watermark}">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td width="${AVATAR_PX}" valign="top" style="width:${AVATAR_PX}px;padding-right:12px;">${avatar(c, t)}</td>
              <td valign="top">
                <div style="font-size:15px;font-weight:700;color:#1a1a19;line-height:1.35;padding-bottom:3px;">${esc(maskCandidateName(c))}</div>
                ${country ? `<div style="font-size:11px;color:#5f5e5a;padding-bottom:8px;">${esc(country)}</div>` : ''}
                ${employment ? `${caption('Availability')}<div style="font-size:11px;color:#5f5e5a;">${esc(employment)}</div>` : ''}
              </td>
            </tr>
          </table>
          ${positionPills ? `<div style="padding-top:14px;">${caption(positions.length > 1 ? 'Positions' : 'Position')}<div>${positionPills}</div></div>` : ''}
          ${skillPills.trim() ? `<div style="padding-top:12px;">${caption('Skills')}<div>${skillPills}</div></div>` : ''}
        </td>
      </tr>
      ${
        rate
          ? `<tr>
        <td style="padding:12px 18px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td valign="bottom">
                ${employment ? `<div style="font-size:9px;font-weight:600;letter-spacing:.4px;text-transform:uppercase;color:#888780;">${esc(employment)}</div>` : ''}
                <div style="line-height:1.2;">${rate}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
          : ''
      }
    </table>`;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

/**
 * Builds the `{{candidateCards}}` value. Returns an empty string when there is
 * nothing to show, so a panel with no candidates simply renders the surrounding
 * copy without an empty frame.
 *
 * @param panelUrl used by the "+N more" line when the list is capped.
 */
export function renderOfferPanelCandidateCards(
  candidates: OfferPanelEmailCandidate[] | null | undefined,
  theme: EmailTheme,
  promoEnabled: boolean,
  panelUrl?: string | null,
): string {
  const list = (candidates ?? []).filter(Boolean);
  if (list.length === 0) return '';

  const t = toCardTheme(theme);
  const shown = list.slice(0, MAX_CARDS);
  const hidden = list.length - shown.length;

  const cards = shown.map((c) => card(c, t, promoEnabled)).join('');

  const moreLine =
    hidden > 0
      ? `<div style="font-size:13px;color:#5f5e5a;padding:2px 0 8px;">${
          panelUrl
            ? `<a href="${esc(panelUrl)}" style="color:${t.primary};font-weight:600;text-decoration:none;">+${hidden} more candidate${hidden !== 1 ? 's' : ''}</a>`
            : `+${hidden} more candidate${hidden !== 1 ? 's' : ''}`
        }</div>`
      : '';

  return stripNewlines(`<div style="padding:4px 0 8px;">${cards}${moreLine}</div>`);
}
