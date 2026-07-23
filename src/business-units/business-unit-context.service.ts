import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Shape of a BusinessUnit row as seen by this resolver.
 *
 * TODO(Task03): `hubspot_value`, `is_visible` and `candidate_pool` are not yet
 * columns on the `BusinessUnit` Prisma model — they're added in Task 03 (a
 * parallel phase). Until that migration lands, every read below is guarded
 * defensively and falls back to matching on `name`/`slug`, treating
 * MedVirtual & Berry Virtual as visible. Drop the fallback once the columns
 * exist and Task03's migration/seed has run.
 */
export interface BusinessUnitRow {
  id: string;
  slug: string;
  name: string;
  is_active?: boolean | null;
  hubspot_value?: string | null;
  is_visible?: boolean | null;
  candidate_pool?: string | null;
}

const CACHE_TTL_MS = 60_000; // 60s — small TTL so gate checks don't hammer the DB

/**
 * Names that are considered visible under the legacy fallback (no
 * hubspot_value/is_visible columns yet). Matched via normalizeBusinessUnit,
 * so both "MedVirtual"/"medvirtual" and "Berry Virtual"/"BerryVirtual" match.
 */
const LEGACY_VISIBLE_NAMES = ['medvirtual', 'berryvirtual'];

@Injectable()
export class BusinessUnitContext {
  private readonly logger = new Logger(BusinessUnitContext.name);

  private cache: BusinessUnitRow[] | null = null;
  private cacheExpiresAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * hubspot_value of every BU currently allowed to operate (known + visible).
   * Falls back to the display name when hubspot_value is not yet populated.
   */
  async getVisibleHubspotValues(): Promise<string[]> {
    const rows = await this.getRows();
    return rows
      .filter((row) => this.isVisible(row))
      .map((row) => this.hubspotValueOf(row))
      .filter((v): v is string => !!v);
  }

  /**
   * True only when `v` matches a known BU (by hubspot_value, name or slug,
   * normalized) AND that BU is visible.
   */
  async isAllowedHubspotValue(v: string): Promise<boolean> {
    if (!v) return false;
    const bu = await this.resolveByHubspotValue(v);
    if (!bu) return false;
    return this.isVisible(bu);
  }

  /** The BusinessUnit row matching `v` (normalized), or null if unknown. */
  async resolveByHubspotValue(v: string): Promise<BusinessUnitRow | null> {
    if (!v) return null;
    const target = this.normalizeBusinessUnit(v);
    const rows = await this.getRows();
    return (
      rows.find((row) => {
        const candidates = [row.hubspot_value, row.name, row.slug].filter(
          (c): c is string => !!c,
        );
        return candidates.some(
          (c) => this.normalizeBusinessUnit(c) === target,
        );
      }) ?? null
    );
  }

  /** candidate_pool of the matching BU (by hubspot_value or slug), or null. */
  async poolFor(hubspotValueOrSlug: string): Promise<string | null> {
    const bu = await this.resolveByHubspotValue(hubspotValueOrSlug);
    if (!bu) return null;
    // TODO(Task03): drop the 'medical' default fallback once candidate_pool exists on every row.
    return bu.candidate_pool ?? 'medical';
  }

  /** Lowercase + hyphenate a display value (mirrors orgBusinessUnitToSlug). */
  displayToSlug(v: string): string | null {
    if (!v) return null;
    return v.toLowerCase().replace(/\s+/g, '-');
  }

  /** trim + lowercase + remove spaces — same rule as the frontend berry-business-unit.ts */
  normalizeBusinessUnit(v?: string | null): string {
    if (!v) return '';
    return v.trim().toLowerCase().replace(/\s+/g, '');
  }

  /** Bust the in-memory cache so the next read hits Prisma again. */
  bustCache(): void {
    this.cache = null;
    this.cacheExpiresAt = 0;
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private async getRows(): Promise<BusinessUnitRow[]> {
    const now = Date.now();
    if (this.cache && now < this.cacheExpiresAt) {
      return this.cache;
    }

    try {
      const rows = await this.prisma.businessUnit.findMany();
      this.cache = rows as unknown as BusinessUnitRow[];
      this.cacheExpiresAt = now + CACHE_TTL_MS;
      return this.cache;
    } catch (error) {
      this.logger.error(
        `Failed to load BusinessUnit rows: ${(error as Error).message}`,
      );
      return this.cache ?? [];
    }
  }

  private hubspotValueOf(row: BusinessUnitRow): string | null {
    // TODO(Task03): drop this fallback once hubspot_value exists on every row.
    return row.hubspot_value ?? row.name ?? null;
  }

  private isVisible(row: BusinessUnitRow): boolean {
    // TODO(Task03): drop this fallback once is_visible exists on every row.
    if (row.is_visible !== undefined && row.is_visible !== null) {
      return row.is_visible;
    }
    return LEGACY_VISIBLE_NAMES.includes(
      this.normalizeBusinessUnit(row.name ?? row.slug),
    );
  }
}
