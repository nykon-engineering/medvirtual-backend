import { Injectable, Logger } from '@nestjs/common';
import { HubspotMatchingService } from './hubspot-matching.service';
import { InvoiceIngestionService } from './invoice-ingestion.service';
import { CommissionDetectionService } from './commission-detection.service';
import { PrismaService } from '../../prisma/prisma.service';

export interface SyncResult {
  organizationId: string;
  phaseA: {
    outcome: string;
    hubspotCompanyId?: string;
    error?: string;
  };
  phaseB?: {
    invoices: { created: number; updated: number; skipped: number };
    commissions: { created: number; skipped: number };
  };
}

@Injectable()
export class ReferralSyncService {
  private readonly logger = new Logger(ReferralSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hubspotMatching: HubspotMatchingService,
    private readonly invoiceIngestion: InvoiceIngestionService,
    private readonly commissionDetection: CommissionDetectionService,
  ) {}

  /**
   * Full sync pipeline for a referred organization.
   *
   * Phase A — HubSpot company matching:
   *   Resolves hubspot_id for the referred org.
   *   Skipped if hubspot_id is already set (idempotent).
   *   Halts pipeline if multiple matches are found.
   *
   * Phase B — Invoice ingestion + commission detection:
   *   Runs only if the org is not blocked and not needs_admin_review.
   *   Idempotent: sync_hash guards invoice re-processing,
   *   idempotency_key guards commission re-creation.
   */
  async run(organizationId: string): Promise<SyncResult> {
    this.logger.log(`Starting sync for organization ${organizationId}`);

    // -------------------------------------------------------------------------
    // Phase A: HubSpot company matching
    // -------------------------------------------------------------------------
    const matchResult = await this.hubspotMatching.run(organizationId);

    const result: SyncResult = {
      organizationId,
      phaseA: {
        outcome: matchResult.outcome,
        hubspotCompanyId: matchResult.hubspotCompanyId,
        error: matchResult.error,
      },
    };

    // Multiple matches or hard error — halt pipeline
    if (
      matchResult.outcome === 'multiple_matches' ||
      matchResult.outcome === 'error'
    ) {
      this.logger.warn(
        `Sync halted for org ${organizationId} — Phase A outcome: ${matchResult.outcome}`,
      );
      return result;
    }

    // -------------------------------------------------------------------------
    // Phase B: Invoice ingestion + commission detection
    // -------------------------------------------------------------------------

    // Reload org to get the latest state (hubspot_id may have just been set by Phase A)
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        hubspot_id: true,
        med_alliance_referral_status: true,
        med_alliance_block_reason: true,
      },
    });

    // Guard: do not run Phase B for blocked referrals
    // Active-client block is permanent — skip Phase B entirely.
    // Other not_eligible states (no first invoice yet, expired window) are handled
    // inside CommissionDetectionService with the full eligibility lifecycle logic.
    if (org?.med_alliance_block_reason?.startsWith('active_client_block')) {
      this.logger.log(
        `Phase B skipped for org ${organizationId} — active-client block`,
      );
      return result;
    }

    // Phase B requires a hubspot_id to query invoices
    if (!org?.hubspot_id) {
      this.logger.log(
        `Phase B skipped for org ${organizationId} — no hubspot_id (no_match outcome)`,
      );
      return {
        ...result,
        phaseB: {
          invoices: { created: 0, updated: 0, skipped: 0 },
          commissions: { created: 0, skipped: 0 },
        },
      };
    }

    const invoiceStats = await this.invoiceIngestion.run(
      organizationId,
      org.hubspot_id,
    );

    //commented only for populate databse
    const commissionStats = await this.commissionDetection.run(organizationId);
    //const commissionStats = { created: 0, skipped: 0 };

    result.phaseB = {
      invoices: invoiceStats,
      commissions: commissionStats,
    };

    this.logger.log(
      `Sync complete for org ${organizationId} — ` +
        `invoices: +${invoiceStats.created} ~${invoiceStats.updated} =${invoiceStats.skipped} | ` +
        `commissions: +${commissionStats.created} =${commissionStats.skipped}`,
    );

    return result;
  }
}
