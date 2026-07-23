import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import axios from 'axios';
import {
  HubspotAuditAction,
  HubspotAuditSource,
  HubspotEntityType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessUnitDto } from './dto/create-business-unit.dto';
import { UpdateBusinessUnitDto } from './dto/update-business-unit.dto';
import { UpdateBrandingDto } from './dto/update-branding.dto';
import { HubspotAuditService } from '../hubspot/hubspot-audit.service';
import { mapOrganizationToDb, mapContactToDb } from '../common/utils/hubspot.util';
import { organizationToDbDictionary } from '../common/dictionaries/organization-dictionary';
import { contactToDbDictionary } from '../common/dictionaries/contact-dictionary';
import { candidadeToDbDictionary } from '../common/dictionaries/candidate-dictionary';
import { affiliateToDbDictionary } from '../common/dictionaries/affiliate-dictionary';
import { OrganizationStatus, AffiliateStatus } from '@prisma/client';

@Injectable()
export class BusinessUnitsService {
  private readonly logger = new Logger(BusinessUnitsService.name);

  // Concurrency guard for backfillFromHubspot — in-memory Set of slugs
  // currently being backfilled. Simple and sufficient for a single-instance
  // (or per-instance) guard; a stray concurrent run for the same slug is
  // rejected rather than silently interleaving two imports of the same data.
  private readonly backfillsInProgress = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly hubspotAudit: HubspotAuditService,
  ) {}

  // ── List ──────────────────────────────────────────────────────────────────

  async findAll() {
    const data = await this.prisma.businessUnit.findMany({
      orderBy: { name: 'asc' },
      include: { branding: true },
    });
    return { status: 200, data };
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async create(dto: CreateBusinessUnitDto, userId: string) {
    const existing = await this.prisma.businessUnit.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new BadRequestException(
        `A business unit with slug "${dto.slug}" already exists`,
      );
    }

    // Create BU and its default EmailBranding in a single transaction
    const [bu] = await this.prisma.$transaction([
      this.prisma.businessUnit.create({
        data: { slug: dto.slug, name: dto.name, created_by: userId },
      }),
      this.prisma.emailBranding.create({
        data: {
          business_unit: dto.slug,
          primary_color: '#01546B',
          secondary_color: '#013A4F',
          logo_url: 'https://staging.medvirtual.ai/logo.png',
          company_name: dto.name,
          layout_preset: 'default',
          button_color: null,
          button_text_color: null,
          updated_by: userId,
        },
      }),
    ]);

    return { status: 201, data: bu };
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(slug: string, dto: UpdateBusinessUnitDto) {
    const before = await this.findOneOrThrow(slug);

    const updated = await this.prisma.businessUnit.update({
      where: { slug },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active }),
        ...(dto.is_visible !== undefined && { is_visible: dto.is_visible }),
        ...(dto.primary_color !== undefined && {
          primary_color: dto.primary_color,
        }),
        ...(dto.primary_hover !== undefined && {
          primary_hover: dto.primary_hover,
        }),
        ...(dto.logo_url !== undefined && { logo_url: dto.logo_url }),
        ...(dto.favicon_url !== undefined && { favicon_url: dto.favicon_url }),
        ...(dto.candidate_pool !== undefined && {
          candidate_pool: dto.candidate_pool,
        }),
      },
      include: { branding: true },
    });

    // Activation transition (false→true): reactivate whatever was tagged
    // deactivated_by_bu for this slug, THEN fire the multi-object backfill
    // fire-and-forget (does not block this response). Any other transition
    // (true→true, true→false, false→false) is a no-op here.
    const wasActivated = before.is_visible === false && updated.is_visible === true;
    if (wasActivated) {
      await this.reactivateDeactivatedByBu(slug);

      this.backfillFromHubspot(slug)
        .then((result) => {
          void this.hubspotAudit.log({
            entityType: HubspotEntityType.organization,
            entityId: slug,
            hubspotObjectType: 'business_unit_backfill',
            action: HubspotAuditAction.SYNC,
            source: HubspotAuditSource.user_action,
            success: true,
            payload: { slug, trigger: 'activation' },
            response: result as unknown as Record<string, unknown>,
          });
        })
        .catch((err: Error) => {
          this.logger.error(
            `backfillFromHubspot failed for "${slug}" after activation: ${err.message}`,
          );
          void this.hubspotAudit.log({
            entityType: HubspotEntityType.organization,
            entityId: slug,
            hubspotObjectType: 'business_unit_backfill',
            action: HubspotAuditAction.SYNC,
            source: HubspotAuditSource.user_action,
            success: false,
            payload: { slug, trigger: 'activation' },
            errorMessage: err.message,
          });
        });
    }

    return { status: 200, data: updated };
  }

  // ── Deactivate (soft delete) ──────────────────────────────────────────────

  async deactivate(slug: string) {
    await this.findOneOrThrow(slug);

    const updated = await this.prisma.businessUnit.update({
      where: { slug },
      data: { is_active: false },
    });

    return { status: 200, data: updated };
  }

  // ── Branding ──────────────────────────────────────────────────────────────

  async getBranding(slug: string) {
    await this.findOneOrThrow(slug);

    const branding = await this.prisma.emailBranding.findUnique({
      where: { business_unit: slug },
    });
    if (!branding)
      throw new NotFoundException(`Branding for "${slug}" not found`);

    return { status: 200, data: branding };
  }

  async updateBranding(slug: string, dto: UpdateBrandingDto, userId: string) {
    await this.findOneOrThrow(slug);

    const current = await this.prisma.emailBranding.findUnique({
      where: { business_unit: slug },
    });
    if (!current)
      throw new NotFoundException(`Branding for "${slug}" not found`);

    // Snapshot to history before overwriting
    await this.prisma.emailBrandingHistory.create({
      data: {
        branding_id: current.id,
        snapshot: {
          primary_color: current.primary_color,
          secondary_color: current.secondary_color,
          logo_url: current.logo_url,
          company_name: current.company_name,
          layout_preset: current.layout_preset,
          button_color: current.button_color,
          button_text_color: current.button_text_color,
        },
        changed_by: userId,
      },
    });

    const updated = await this.prisma.emailBranding.update({
      where: { business_unit: slug },
      data: {
        ...(dto.primary_color !== undefined && {
          primary_color: dto.primary_color,
        }),
        ...(dto.secondary_color !== undefined && {
          secondary_color: dto.secondary_color,
        }),
        ...(dto.logo_url !== undefined && { logo_url: dto.logo_url }),
        ...(dto.company_name !== undefined && {
          company_name: dto.company_name,
        }),
        ...(dto.layout_preset !== undefined && {
          layout_preset: dto.layout_preset,
        }),
        ...(dto.button_color !== undefined && {
          button_color: dto.button_color,
        }),
        ...(dto.button_text_color !== undefined && {
          button_text_color: dto.button_text_color,
        }),
        updated_by: userId,
      },
    });

    // Fire-and-forget sync to peer environment
    this.syncBrandingToPeer(slug, updated, userId).catch((err) =>
      this.logger.error(
        `Branding sync to peer failed for "${slug}": ${err.message}`,
      ),
    );

    return { status: 200, data: updated };
  }

  async getBrandingHistory(slug: string) {
    await this.findOneOrThrow(slug);

    const branding = await this.prisma.emailBranding.findUnique({
      where: { business_unit: slug },
      select: { id: true },
    });
    if (!branding)
      throw new NotFoundException(`Branding for "${slug}" not found`);

    const history = await this.prisma.emailBrandingHistory.findMany({
      where: { branding_id: branding.id },
      orderBy: { changed_at: 'desc' },
      take: 50,
    });

    return { status: 200, data: history };
  }

  // ── Sync ──────────────────────────────────────────────────────────────────

  async receiveBrandingSyncFromPeer(
    slug: string,
    payload: {
      primary_color?: string;
      secondary_color?: string;
      logo_url?: string;
      company_name?: string;
      layout_preset?: string;
      button_color?: string;
      button_text_color?: string;
    },
    originEnv: string,
  ) {
    const branding = await this.prisma.emailBranding.findUnique({
      where: { business_unit: slug },
    });
    if (!branding) {
      this.logger.warn(
        `Branding sync received for unknown BU "${slug}" — ignored`,
      );
      return;
    }

    await this.prisma.emailBrandingHistory.create({
      data: {
        branding_id: branding.id,
        snapshot: {
          primary_color: branding.primary_color,
          secondary_color: branding.secondary_color,
          logo_url: branding.logo_url,
          company_name: branding.company_name,
          layout_preset: branding.layout_preset,
          button_color: branding.button_color,
          button_text_color: branding.button_text_color,
        },
        changed_by: 'sync',
      },
    });

    await this.prisma.emailBranding.update({
      where: { business_unit: slug },
      data: {
        ...(payload.primary_color !== undefined && {
          primary_color: payload.primary_color,
        }),
        ...(payload.secondary_color !== undefined && {
          secondary_color: payload.secondary_color,
        }),
        ...(payload.logo_url !== undefined && { logo_url: payload.logo_url }),
        ...(payload.company_name !== undefined && {
          company_name: payload.company_name,
        }),
        ...(payload.layout_preset !== undefined && {
          layout_preset: payload.layout_preset,
        }),
        ...(payload.button_color !== undefined && {
          button_color: payload.button_color,
        }),
        ...(payload.button_text_color !== undefined && {
          button_text_color: payload.button_text_color,
        }),
        updated_by: 'sync',
      },
    });

    this.logger.log(`Branding for "${slug}" synced from ${originEnv}`);
  }

  private async syncBrandingToPeer(
    slug: string,
    branding: {
      primary_color: string;
      secondary_color?: string | null;
      logo_url?: string | null;
      company_name: string;
      layout_preset: string;
      button_color?: string | null;
      button_text_color?: string | null;
    },
    userId: string,
  ) {
    const peerUrl = process.env.PEER_ENV_API_URL;
    const secret = process.env.INTER_ENV_SYNC_SECRET;
    const currentEnv = process.env.ENVIRONMENT ?? 'DEV';

    if (!peerUrl || !secret) return;

    await fetch(`${peerUrl}/business-units/${slug}/branding/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Secret': secret,
        'X-Sync-Origin': currentEnv,
        'X-Sync-By': userId,
      },
      body: JSON.stringify({
        primary_color: branding.primary_color,
        secondary_color: branding.secondary_color,
        logo_url: branding.logo_url,
        company_name: branding.company_name,
        layout_preset: branding.layout_preset,
        button_color: branding.button_color,
        button_text_color: branding.button_text_color,
      }),
    });

    this.logger.log(`Branding for "${slug}" synced to peer (${peerUrl})`);
  }

  // ── Backfill (Task 06) ───────────────────────────────────────────────────

  /**
   * Multi-object, non-destructive backfill for a BU: pulls pre-existing
   * HubSpot objects for `bu.hubspot_value` across all 4 types and upserts
   * them by `hubspot_id` (never deletes). Safe to re-run (idempotent) and
   * guarded against concurrent runs for the same slug.
   *
   * Reuses the same mapping dictionaries/helpers as the webhook handlers:
   * - companies      → `mapOrganizationToDb` / `organizationToDbDictionary` (organizationCreation.ts)
   * - contacts       → `mapContactToDb` / `contactToDbDictionary` (contactCreation.ts)
   * - VA custom obj  → `candidadeToDbDictionary` (objectCreation.ts)
   * - Growth Partner → `affiliateToDbDictionary` (affiliateCreation.ts / syncGrowthPartnersFromHubspot)
   */
  async backfillFromHubspot(slug: string): Promise<{
    organizations: number;
    contacts: number;
    candidates: number;
    affiliates: number;
  }> {
    const bu = await this.findOneOrThrow(slug);

    if (this.backfillsInProgress.has(slug)) {
      throw new BadRequestException(
        `A backfill is already in progress for business unit "${slug}"`,
      );
    }
    this.backfillsInProgress.add(slug);

    try {
      const businessUnitValue = bu.hubspot_value ?? bu.name;

      const [organizations, contacts, candidates, affiliates] =
        await Promise.all([
          this.backfillOrganizations(businessUnitValue),
          this.backfillContacts(businessUnitValue),
          this.backfillCandidates(businessUnitValue),
          this.backfillAffiliates(businessUnitValue),
        ]);

      this.logger.log(
        `backfillFromHubspot("${slug}"): organizations=${organizations}, contacts=${contacts}, candidates=${candidates}, affiliates=${affiliates}`,
      );

      return { organizations, contacts, candidates, affiliates };
    } finally {
      this.backfillsInProgress.delete(slug);
    }
  }

  private async searchHubspotByBusinessUnit(
    objectType: string,
    businessUnitValue: string,
    properties: string[],
  ): Promise<Array<{ id: string; properties: Record<string, any> }>> {
    const results: Array<{ id: string; properties: Record<string, any> }> = [];
    let after: string | undefined;

    do {
      const body: Record<string, unknown> = {
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'business_unit',
                operator: 'EQ',
                value: businessUnitValue,
              },
            ],
          },
        ],
        properties,
        limit: 100,
        ...(after && { after }),
      };

      const response = await axios.post(
        `https://api.hubapi.com/crm/v3/objects/${objectType}/search`,
        body,
        {
          headers: {
            Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      );

      results.push(...(response.data?.results ?? []));
      after = response.data?.paging?.next?.after;
    } while (after);

    return results;
  }

  private async backfillOrganizations(businessUnitValue: string): Promise<number> {
    const properties = Object.keys(organizationToDbDictionary);
    const companies = await this.searchHubspotByBusinessUnit(
      'companies',
      businessUnitValue,
      properties,
    );

    let count = 0;
    for (const company of companies) {
      const hubspotId = String(company.id);
      const organizationData = mapOrganizationToDb(company.properties);

      await this.prisma.organization.upsert({
        where: { hubspot_id: hubspotId },
        create: {
          ...(organizationData as any),
          hubspot_id: hubspotId,
          name: organizationData.name ?? company.properties.name ?? 'Unknown',
          status: OrganizationStatus.inactive,
        },
        update: {
          ...(organizationData as any),
        },
      });
      count++;
    }
    return count;
  }

  private async backfillContacts(businessUnitValue: string): Promise<number> {
    const properties = Object.keys(contactToDbDictionary);
    const contacts = await this.searchHubspotByBusinessUnit(
      'contacts',
      businessUnitValue,
      properties,
    );

    let count = 0;
    for (const contact of contacts) {
      const hubspotId = String(contact.id);
      const contactData = mapContactToDb(contact.properties);

      await this.prisma.contact.upsert({
        where: { hubspot_id: hubspotId },
        create: { ...contactData, hubspot_id: hubspotId },
        update: { ...contactData },
      });
      count++;
    }
    return count;
  }

  private async backfillCandidates(businessUnitValue: string): Promise<number> {
    const objectType = process.env.HUBSPOT_CUSTOM_OBJECT ?? '2-5922196';
    const properties = Object.keys(candidadeToDbDictionary);
    const candidates = await this.searchHubspotByBusinessUnit(
      objectType,
      businessUnitValue,
      properties,
    );

    let count = 0;
    for (const candidate of candidates) {
      const hubspotId = String(candidate.id);
      const candidateData: Record<string, any> = {};

      for (const [hubspotKey, dbField] of Object.entries(
        candidadeToDbDictionary,
      )) {
        const value = candidate.properties[hubspotKey];
        if (value === undefined) continue;

        if (Array.isArray(dbField)) {
          dbField.forEach((field) => {
            candidateData[field] = value;
          });
        } else {
          candidateData[dbField] = value;
        }
      }

      await this.prisma.candidate.upsert({
        where: { hubspot_id: hubspotId },
        create: {
          ...candidateData,
          hubspot_id: hubspotId,
          // HubSpot's VA object always carries `email` (mapped above via
          // candidadeToDbDictionary) — same assumption objectCreation.ts
          // makes for webhook-driven candidate creation.
          email: candidateData.email ?? `unknown+${hubspotId}@medvirtual.ai`,
          processing_status: 'pending',
        } as Prisma.CandidateCreateInput,
        update: { ...candidateData },
      });
      count++;
    }
    return count;
  }

  private async backfillAffiliates(businessUnitValue: string): Promise<number> {
    const objectType =
      process.env.HUBSPOT_GROWTH_PARTNER_CUSTOM_OBJECT ?? '2-54072002';
    const properties = Object.keys(affiliateToDbDictionary);
    const affiliates = await this.searchHubspotByBusinessUnit(
      objectType,
      businessUnitValue,
      properties,
    );

    let count = 0;
    for (const affiliate of affiliates) {
      const hubspotId = String(affiliate.id);
      const affiliateData: Record<string, any> = {};

      for (const [hubspotKey, dbField] of Object.entries(
        affiliateToDbDictionary,
      )) {
        const value = affiliate.properties[hubspotKey];
        if (value === undefined) continue;
        affiliateData[dbField] = value;
      }

      await this.prisma.affiliateProfile.upsert({
        where: { hubspot_id: hubspotId },
        create: {
          full_name: affiliateData.full_name ?? null,
          hubspot_pipeline: affiliateData.hubspot_pipeline ?? null,
          hubspot_pipeline_stage: affiliateData.hubspot_pipeline_stage ?? null,
          business_unit: affiliateData.business_unit ?? businessUnitValue,
          commission_percent_default:
            affiliateData.commission_percent_default ?? 7,
          hubspot_id: hubspotId,
          status: AffiliateStatus.pending,
        },
        update: {
          full_name: affiliateData.full_name ?? undefined,
          hubspot_pipeline: affiliateData.hubspot_pipeline ?? undefined,
          hubspot_pipeline_stage:
            affiliateData.hubspot_pipeline_stage ?? undefined,
          business_unit: affiliateData.business_unit ?? undefined,
        },
      });
      count++;
    }
    return count;
  }

  /**
   * Reactivation half of the activation flow — restores exactly the set of
   * rows tagged `deactivated_by_bu = slug` across all 4 object types, and
   * clears the tag. Always runs BEFORE the backfill kicks off.
   */
  private async reactivateDeactivatedByBu(slug: string): Promise<void> {
    await this.prisma.organization.updateMany({
      where: { deactivated_by_bu: slug },
      data: { status: OrganizationStatus.inactive, deactivated_by_bu: null },
    });

    await this.prisma.uSER.updateMany({
      where: { deactivated_by_bu: slug },
      data: { status: 'inactive', deactivated_by_bu: null },
    });

    await this.prisma.candidate.updateMany({
      where: { deactivated_by_bu: slug },
      data: { deactivated_by_bu: null },
    });

    await this.prisma.affiliateProfile.updateMany({
      where: { deactivated_by_bu: slug },
      data: { status: AffiliateStatus.active, deactivated_by_bu: null },
    });

    this.logger.log(
      `reactivateDeactivatedByBu("${slug}"): restored all rows tagged deactivated_by_bu="${slug}"`,
    );
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private async findOneOrThrow(slug: string) {
    const bu = await this.prisma.businessUnit.findUnique({ where: { slug } });
    if (!bu) throw new NotFoundException(`Business unit "${slug}" not found`);
    return bu;
  }
}
