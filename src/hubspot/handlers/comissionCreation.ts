import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CommissionStatus } from '@prisma/client';

@Injectable()
export class HandlerComissionCreation {
  constructor(private readonly prisma: PrismaService) {}

  async execute(event) {
    try {
      const invoiceExists = await this.prisma.hubspotInvoiceSnapshot.findUnique(
        {
          where: {
            hubspot_id: String(event.objectId),
          },
          select: {
            id: true,
            invoice_amount: true,
            organization: {
              select: {
                id: true,
                med_alliance_referral_status: true,
                eligibility_start_at: true,
                referredByAffiliate: {
                  //user
                  select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                    affiliateProfile: {
                      select: {
                        id: true,
                        full_name: true,
                        commission_percent_default: true,
                        status: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      );

      if (
        invoiceExists?.organization?.referredByAffiliate?.affiliateProfile
          ?.status !== 'active'
      ) {
        console.log(
          `The affiliate linked to the organization of the invoice with Hubspot ID ${event.objectId} is not active. No comission will be created.`,
        );
        return;
      }
      if (invoiceExists?.invoice_amount === null) {
        console.log(
          `The invoice with Hubspot ID ${event.objectId} has no amount billed. No comission will be created.`,
        );
        return;
      }

      const comissionAmount =
        invoiceExists?.organization.referredByAffiliate?.affiliateProfile
          ?.commission_percent_default || 0;
      const baseAmmount = invoiceExists.invoice_amount;
      const comissionAmountValue =
        (Number(baseAmmount) * Number(comissionAmount)) / 100;
      const idempotencyKey = `${invoiceExists.id}-${invoiceExists.organization.referredByAffiliate.id}`;

      // One year in milliseconds — used for the eligibility window and referral-age rule.
      const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

      // 30-day stabilization window: deployed companies must be deployed for this long before going eligible.
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

      const isEligibleNow =
        invoiceExists.organization.med_alliance_referral_status ===
          'eligible' &&
        invoiceExists.organization.eligibility_start_at != null &&
        Date.now() -
          invoiceExists.organization.eligibility_start_at.getTime() >=
          THIRTY_DAYS_MS &&
        Date.now() -
          invoiceExists.organization.eligibility_start_at.getTime() <=
          ONE_YEAR_MS;

      const commissionStatus = isEligibleNow
        ? CommissionStatus.pending_admin_confirmation
        : CommissionStatus.detected;

      await this.prisma.affiliateCommission.upsert({
        where: { idempotency_key: idempotencyKey },
        update: {}, // dont update anything if the record already exists
        create: {
          idempotency_key: idempotencyKey,
          affiliate_id: invoiceExists.organization.referredByAffiliate.id,
          affiliate_profile_id:
            invoiceExists.organization.referredByAffiliate.affiliateProfile.id,
          organization_id: invoiceExists.organization.id,
          hubspot_invoice_snapshot_id: invoiceExists.id,
          commission_percent_snapshot: comissionAmount,
          base_amount_snapshot: baseAmmount,
          commission_amount: comissionAmountValue,
          status: commissionStatus,
        },
      });

      return true;
    } catch (error) {
      console.error(`❌ Error creating comission ${event.objectId}`);
      console.error('Status:', error.response?.status);
      console.error('Data:', error.response?.data);
      console.error('Message:', error.message);
      throw new BadRequestException(
        `Error creating comission: ${error.message}`,
      );
    }
  }
}
