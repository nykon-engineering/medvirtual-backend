/**
 * Escapes a value for safe interpolation into email HTML.
 *
 * Email templates interpolate a lot of free-text, user- and HubSpot-controlled
 * data (candidate names, org names, panel titles, error messages), and the
 * template renderer injects placeholder values RAW — it does no escaping of its
 * own. Every such value must pass through here before reaching the markup.
 *
 * `&` is replaced first: doing it later would double-escape the entities the
 * other replacements just introduced.
 */
export function escapeEmailHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
