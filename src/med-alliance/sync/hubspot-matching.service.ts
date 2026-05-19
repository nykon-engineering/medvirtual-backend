import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { EligibilityCheckService } from '../referred-companies/eligibility-check.service';
import { ReviewCasesService } from '../review-cases/review-cases.service';

export type MatchOutcome =
  | 'already_matched' // hubspot_id was already set — Phase A skipped
  | 'synced' // exactly 1 match found and stored
  | 'no_match' // 0 matches — Phase B will run without hubspot_id
  | 'multiple_matches' // 2+ matches — pipeline halted, admin review required
  | 'error'; // HubSpot API failure

export interface MatchResult {
  outcome: MatchOutcome;
  hubspotCompanyId?: string;
  error?: string;
}

@Injectable()
export class HubspotMatchingService {
  private readonly logger = new Logger(HubspotMatchingService.name);
  private readonly baseUrl = 'https://api.hubapi.com';

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly eligibilityCheck: EligibilityCheckService,
    private readonly reviewCases: ReviewCasesService,
  ) {}

  /**
   * Phase A: resolve which HubSpot company corresponds to the referred organization.
   *
   * Matching strategy (in order of confidence):
   *   1. domain extracted from website_url
   *   2. company name
   *   3. email domain
   *
   * Outcomes:
   *   - 0 results → no_match (pipeline continues without hubspot_id)
   *   - 1 result  → stores hubspot_id, re-runs MA-004, returns 'synced'
   *   - 2+ results → sets needs_admin_review, sends admin email, halts pipeline
   */
  async run(organizationId: string): Promise<MatchResult> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        website_url: true,
        hubspot_id: true,
        referred_by_affiliate_id: true,
        referredByAffiliate: {
          select: { first_name: true, last_name: true, email: true },
        },
      },
    });

    if (!org) return { outcome: 'error', error: 'Organization not found' };

    // Idempotency: skip if already matched
    if (org.hubspot_id) {
      return { outcome: 'already_matched', hubspotCompanyId: org.hubspot_id };
    }

    try {
      const results = await this.searchHubspotCompany(org);

      if (results.length === 0) {
        await this.persistSyncState(organizationId, {
          hubspot_sync_status: 'no_match',
          hubspot_sync_error: null,
          hubspot_synced_at: new Date(),
        });
        return { outcome: 'no_match' };
      }

      if (results.length > 1) {
        await this.handleMultipleMatches(
          organizationId,
          org,
          !!org.referred_by_affiliate_id,
        );
        return { outcome: 'multiple_matches' };
      }

      // Exactly one match
      const hubspotCompanyId = results[0].id;
      await this.persistSyncState(organizationId, {
        hubspot_id: hubspotCompanyId,
        hubspot_sync_status: 'synced',
        hubspot_sync_error: null,
        hubspot_synced_at: new Date(),
      });

      // MA-004: re-run eligibility check now that hubspot_id is set.
      // Only applies to referred orgs — non-referred orgs have no Med Alliance eligibility.
      if (org.referred_by_affiliate_id) {
        await this.eligibilityCheck.runAndPersist(
          organizationId,
          'system',
          'sync',
        );
      }

      return { outcome: 'synced', hubspotCompanyId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `HubSpot matching failed for org ${organizationId}: ${message}`,
      );

      await this.persistSyncState(organizationId, {
        hubspot_sync_status: 'error',
        hubspot_sync_error: message,
      });

      return { outcome: 'error', error: message };
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Searches HubSpot for companies matching the referred organization.
   * Uses domain, name, and email as filter criteria combined with OR logic.
   */
  private async searchHubspotCompany(org: {
    name: string;
    email?: string | null;
    website_url?: string | null;
  }): Promise<Array<{ id: string }>> {
    const filters: any[] = [];

    // Build filter groups — each group is an OR candidate
    const domain = this.extractDomain(org.website_url);
    if (domain) {
      filters.push({
        filters: [{ propertyName: 'domain', operator: 'EQ', value: domain }],
      });
    }

    if (org.name) {
      filters.push({
        filters: [{ propertyName: 'name', operator: 'EQ', value: org.name }],
      });
    }

    if (org.email) {
      const emailDomain = org.email.split('@')[1];
      if (emailDomain) {
        filters.push({
          filters: [
            { propertyName: 'domain', operator: 'EQ', value: emailDomain },
          ],
        });
      }
    }

    if (filters.length === 0) return [];

    const response = await axios.post(
      `${this.baseUrl}/crm/v3/objects/companies/search`,
      {
        filterGroups: filters,
        properties: ['hs_object_id', 'name', 'domain'],
        limit: 10,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return (response.data?.results ?? []).map((r: any) => ({ id: r.id }));
  }

  /**
   * Handles the multiple-matches outcome:
   * - Sets referral status to needs_admin_review
   * - Stores sync status
   * - Sends notification email to admin
   */
  private async handleMultipleMatches(
    organizationId: string,
    org: {
      name: string;
      referredByAffiliate?: {
        first_name: string;
        last_name: string;
        email: string;
      } | null;
    },
    isReferred: boolean,
  ) {
    const updateData: Record<string, any> = {
      hubspot_sync_status: 'multiple_matches',
      hubspot_sync_error:
        'Multiple HubSpot company records matched. Manual review required.',
      hubspot_synced_at: null,
    };

    // Only set Med Alliance eligibility fields for referred organizations
    if (isReferred) {
      updateData.med_alliance_referral_status = 'not_eligible';
    }

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: updateData,
    });

    if (!isReferred) {
      return;
    }

    // MA-006: open an admin review case so it appears in the review queue
    await this.reviewCases.openOrSkip(
      organizationId,
      'multiple_hubspot_matches',
      {
        company_name: org.name,
      },
    );

    const affiliateName = org.referredByAffiliate
      ? `${org.referredByAffiliate.first_name} ${org.referredByAffiliate.last_name} (${org.referredByAffiliate.email})`
      : 'Unknown affiliate';

    await this.mailService.sendMail({
      from: 'med-alliance@medvirtual.com',
      to: 'paulo@regenta.ai',
      subject: `[Med Alliance] Multiple HubSpot Matches — Review Required`,
      html: `
        <h2>Med Alliance — Admin Review Required</h2>
        <p>A referral requires manual review because multiple HubSpot company records were found.</p>
        <table>
          <tr><td><strong>Company:</strong></td><td>${org.name}</td></tr>
          <tr><td><strong>Organization ID:</strong></td><td>${organizationId}</td></tr>
          <tr><td><strong>Referred by:</strong></td><td>${affiliateName}</td></tr>
        </table>
        <p>
          <a href="${process.env.FRONTEND_URL ?? ''}/admin/med-alliance/referred-companies/${organizationId}">
            Review this referral
          </a>
        </p>
      `,
    });
  }

  /** Extracts the base domain from a URL string. */
  private extractDomain(url?: string | null): string | null {
    if (!url) return null;
    try {
      const normalized = url.startsWith('http') ? url : `https://${url}`;
      return new URL(normalized).hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  }

  /** Applies a partial update to Organization sync fields. */
  private async persistSyncState(
    organizationId: string,
    data: Record<string, any>,
  ) {
    await this.prisma.organization.update({
      where: { id: organizationId },
      data,
    });
  }
}
