import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { ReviewCasesService } from '../review-cases/review-cases.service';

export interface InvoiceRecord {
  hubspot_id: string;
  invoice_status: string;
  payment_status: string | null;
  invoice_amount: string;
  currency: string;
  paid_at: Date | null;
  raw_payload: any;
}

@Injectable()
export class InvoiceIngestionService {
  private readonly logger = new Logger(InvoiceIngestionService.name);
  private readonly baseUrl = 'https://api.hubapi.com';

  // HubSpot invoice properties to request
  private readonly INVOICE_PROPERTIES = [
    'hs_object_id',
    'hs_invoice_status',
    'hs_payment_status',
    'hs_amount_billed',
    'hs_currency_code',
    'hs_payment_date', // paid_at equivalent — date payment was settled
    'hs_lastmodifieddate',
  ].join(',');

  constructor(
    private readonly prisma: PrismaService,
    private readonly reviewCases: ReviewCasesService,
  ) {}

  /**
   * Phase B Step 1: fetch all invoices associated with the HubSpot company,
   * then upsert them as HubspotInvoiceSnapshot records.
   *
   * Uses sync_hash to skip invoices that have not changed since the last sync.
   *
   * @returns count of created and updated snapshots
   */
  async run(
    organizationId: string,
    hubspotCompanyId: string,
  ): Promise<{ created: number; updated: number; skipped: number }> {
    const invoiceIds = await this.fetchInvoiceIds(hubspotCompanyId);

    if (invoiceIds.length === 0) {
      this.logger.log(
        `No invoices found for HubSpot company ${hubspotCompanyId} (org ${organizationId})`,
      );
      return { created: 0, updated: 0, skipped: 0 };
    }

    const invoices = await this.fetchInvoiceDetails(invoiceIds);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const invoice of invoices) {
      try {
        const result = await this.upsertSnapshot(organizationId, invoice);
        if (result === 'created') created++;
        else if (result === 'updated') updated++;
        else skipped++;
      } catch (err) {
        this.logger.error(
          `Failed to upsert snapshot for invoice ${invoice.hubspot_id}: ${err instanceof Error ? err.message : err}`,
        );
        // Non-blocking: log and continue with remaining invoices
      }
    }

    this.logger.log(
      `Invoice ingestion for org ${organizationId}: created=${created} updated=${updated} skipped=${skipped}`,
    );

    return { created, updated, skipped };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Fetches invoice IDs associated with a HubSpot company via the associations endpoint.
   * GET /crm/v3/objects/companies/{companyId}/associations/invoices
   */
  private async fetchInvoiceIds(hubspotCompanyId: string): Promise<string[]> {
    const response = await axios.get(
      `${this.baseUrl}/crm/v3/objects/companies/${hubspotCompanyId}/associations/invoices`,
      {
        headers: {
          Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
        },
      },
    );

    const results: Array<{ id: string }> = response.data?.results ?? [];
    return results.map((r) => r.id);
  }

  /**
   * Fetches full invoice details for a list of invoice IDs.
   * Batches requests individually — HubSpot's batch read could be used for optimization later.
   * Includes payment associations to resolve paid_at via hs_initiated_date,
   * since hs_payment_date on the invoice itself is often empty.
   */
  private async fetchInvoiceDetails(
    invoiceIds: string[],
  ): Promise<InvoiceRecord[]> {
    const records: InvoiceRecord[] = [];

    for (const id of invoiceIds) {
      try {
        const response = await axios.get(
          `${this.baseUrl}/crm/v3/objects/invoices/${id}?properties=${this.INVOICE_PROPERTIES}&associations=payments`,
          {
            headers: {
              Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
            },
          },
        );

        const props = response.data?.properties ?? {};
        const paymentResults: Array<{ id: string }> =
          response.data?.associations?.payments?.results ?? [];

        const paidAt = await this.resolvePaidAt(
          props.hs_payment_date,
          paymentResults,
        );

        records.push({
          hubspot_id: id,
          invoice_status: props.hs_invoice_status ?? 'unknown',
          payment_status: props.hs_payment_status ?? null,
          invoice_amount: props.hs_amount_billed ?? '0',
          currency: props.hs_currency_code ?? 'USD',
          paid_at: paidAt,
          raw_payload: response.data,
        });
      } catch (err) {
        this.logger.error(
          `Failed to fetch invoice ${id} from HubSpot: ${err instanceof Error ? err.message : err}`,
        );
        // Non-blocking: skip this invoice
      }
    }

    return records;
  }

  /**
   * Resolves paid_at for an invoice.
   * Prefers hs_payment_date from the invoice; falls back to hs_initiated_date
   * fetched from the first associated payment object when hs_payment_date is absent.
   */
  private async resolvePaidAt(
    hsPaymentDate: string | null | undefined,
    paymentResults: Array<{ id: string }>,
  ): Promise<Date | null> {
    if (hsPaymentDate) {
      return new Date(hsPaymentDate);
    }

    if (paymentResults.length === 0) {
      return null;
    }

    try {
      const paymentId = paymentResults[0].id;
      const paymentResponse = await axios.get(
        `${this.baseUrl}/crm/v3/objects/payments/${paymentId}?properties=hs_initiated_date`,
        {
          headers: {
            Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
          },
        },
      );
      const initiatedDate =
        paymentResponse.data?.properties?.hs_initiated_date;
      return initiatedDate ? new Date(initiatedDate) : null;
    } catch (err) {
      this.logger.warn(
        `Could not fetch payment date for payment ${paymentResults[0].id}: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  /**
   * Upserts a single HubspotInvoiceSnapshot using sync_hash for change detection.
   * - If snapshot does not exist → create
   * - If snapshot exists and hash changed → update
   * - If snapshot exists and hash unchanged → skip
   */
  private async upsertSnapshot(
    organizationId: string,
    invoice: InvoiceRecord,
  ): Promise<'created' | 'updated' | 'skipped'> {
    const syncHash = this.computeSyncHash(invoice);

    const existing = await this.prisma.hubspotInvoiceSnapshot.findUnique({
      where: { hubspot_id: invoice.hubspot_id },
      select: {
        id: true,
        sync_hash: true,
        invoice_amount: true,
        // Check if a commission has already been detected for this snapshot
        commissions: {
          where: { status: { notIn: ['void', 'rejected'] } },
          select: { id: true, status: true },
          take: 1,
        },
      },
    });

    if (!existing) {
      await this.prisma.hubspotInvoiceSnapshot.create({
        data: {
          hubspot_id: invoice.hubspot_id,
          organization_id: organizationId,
          invoice_status: invoice.invoice_status,
          payment_status: invoice.payment_status,
          invoice_amount: invoice.invoice_amount,
          currency: invoice.currency,
          paid_at: invoice.paid_at,
          sync_hash: syncHash,
          raw_payload: invoice.raw_payload,
        },
      });
      return 'created';
    }

    if (existing.sync_hash === syncHash) {
      return 'skipped';
    }

    await this.prisma.hubspotInvoiceSnapshot.update({
      where: { id: existing.id },
      data: {
        invoice_status: invoice.invoice_status,
        payment_status: invoice.payment_status,
        invoice_amount: invoice.invoice_amount,
        currency: invoice.currency,
        paid_at: invoice.paid_at,
        sync_hash: syncHash,
        raw_payload: invoice.raw_payload,
      },
    });

    // MA-006: if a live commission was already detected for this snapshot, flag for admin review
    const linkedCommission = existing.commissions?.[0];
    if (linkedCommission) {
      await this.reviewCases.openOrSkip(
        organizationId,
        'reconciliation_invoice_changed',
        {
          snapshot_id: existing.id,
          commission_id: linkedCommission.id,
          hubspot_invoice_id: invoice.hubspot_id,
          old_amount: existing.invoice_amount?.toString(),
          new_amount: invoice.invoice_amount,
        },
      );
    }

    return 'updated';
  }

  /**
   * Computes a deterministic SHA-256 hash of the invoice's mutable fields.
   * If none of these fields change, the snapshot does not need updating.
   */
  private computeSyncHash(invoice: InvoiceRecord): string {
    const payload = [
      invoice.hubspot_id,
      invoice.invoice_status,
      invoice.payment_status ?? '',
      invoice.invoice_amount,
      invoice.currency,
      invoice.paid_at ? invoice.paid_at.toISOString() : '',
    ].join('|');

    return createHash('sha256').update(payload).digest('hex');
  }
}
