import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HandlerOrganizationCreation } from './organizationCreation';
import { HandlerInvoiceCreation } from './invoiceCreation';
import { AllianceNotificationsService } from '../../med-alliance/notifications/notifications.service';

interface InvoiceAssociationEvent {
  associationType: string;
  fromObjectId: number | string;
  toObjectId: number | string;
  [key: string]: unknown;
}

type AffiliateName = {
  first_name?: string | null;
  last_name?: string | null;
} | null;

@Injectable()
export class HandlerInvoiceAssociationChange {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationCreation: HandlerOrganizationCreation,
    private readonly invoiceCreation: HandlerInvoiceCreation,
    private readonly allianceNotifications: AllianceNotificationsService,
  ) {}

  async execute(event: InvoiceAssociationEvent) {
    switch (event.associationType) {
      case 'COMPANY_TO_INVOICE':
        //fromObjectId => company/organization
        //toObjectId => invoice
        await this.reassociate(
          String(event.fromObjectId),
          String(event.toObjectId),
          event,
        );
        break;

      case 'INVOICE_TO_COMPANY':
        //fromObjectId => invoice
        //toObjectId => company/organization
        await this.reassociate(
          String(event.toObjectId),
          String(event.fromObjectId),
          event,
        );
        break;
    }

    return true;
  }

  /**
   * Points the invoice snapshot at the company from the HubSpot event.
   *
   * When the invoice was already associated with a DIFFERENT organization, this
   * is a re-association. We do NOT touch any commission automatically (HubSpot is
   * the source of truth and we cannot safely reverse a payout on our side) — we
   * only notify the Med Alliance admin so a human can decide what to do.
   */
  private async reassociate(
    companyHubspotId: string,
    invoiceHubspotId: string,
    event: InvoiceAssociationEvent,
  ): Promise<void> {
    let organization = await this.prisma.organization.findUnique({
      where: { hubspot_id: companyHubspotId },
      select: {
        id: true,
        name: true,
        referredByAffiliate: this.affiliateSelect,
      },
    });

    //If the organization is not found, we create it
    if (!organization) {
      await this.organizationCreation.execute(event);
      organization = await this.prisma.organization.findUnique({
        where: { hubspot_id: companyHubspotId },
        select: {
          id: true,
          name: true,
          referredByAffiliate: this.affiliateSelect,
        },
      });
    }
    if (!organization) return;

    let invoice = await this.prisma.hubspotInvoiceSnapshot.findUnique({
      where: { hubspot_id: invoiceHubspotId },
      select: {
        id: true,
        invoice_number: true,
        organization_id: true,
        organization: {
          select: {
            id: true,
            name: true,
            referredByAffiliate: this.affiliateSelect,
          },
        },
      },
    });

    if (!invoice) {
      const eventInvoice = { ...event, objectId: invoiceHubspotId };
      const newInvoice = await this.invoiceCreation.execute(eventInvoice);
      if (!newInvoice) {
        console.log(
          'Impossible to create invoice from invoiceCreation handler | Maybe this invoice is not in the right rule',
        );
        return;
      }
      invoice = await this.prisma.hubspotInvoiceSnapshot.findUnique({
        where: { hubspot_id: invoiceHubspotId },
        select: {
          id: true,
          invoice_number: true,
          organization_id: true,
          organization: {
            select: {
              id: true,
              name: true,
              referredByAffiliate: this.affiliateSelect,
            },
          },
        },
      });
      if (!invoice) return;
    }

    // A re-association only matters when the invoice was already linked to a
    // different organization. If it already points at this org (e.g. a webhook
    // replay), there is nothing to notify about.
    const isReassociation =
      invoice.organization_id != null &&
      invoice.organization_id !== organization.id;

    if (isReassociation) {
      await this.allianceNotifications.notifyAdminInvoiceReassociated({
        invoiceHubspotId,
        invoiceNumber: invoice.invoice_number,
        oldOrganizationName: invoice.organization?.name ?? 'Unknown company',
        newOrganizationName: organization.name ?? 'Unknown company',
        oldAffiliateName: this.affiliateName(
          invoice.organization?.referredByAffiliate,
        ),
        newAffiliateName: this.affiliateName(organization.referredByAffiliate),
      });
    }

    await this.prisma.hubspotInvoiceSnapshot.update({
      where: { hubspot_id: invoiceHubspotId },
      data: { organization_id: organization.id },
    });
  }

  private readonly affiliateSelect = {
    select: { first_name: true, last_name: true },
  };

  private affiliateName(affiliate?: AffiliateName): string | null {
    if (!affiliate) return null;
    const name =
      `${affiliate.first_name ?? ''} ${affiliate.last_name ?? ''}`.trim();
    return name.length > 0 ? name : null;
  }
}
