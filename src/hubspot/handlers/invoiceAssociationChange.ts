import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HandlerOrganizationCreation } from './organizationCreation';
import { HandlerInvoiceCreation } from './invoiceCreation';

@Injectable()
export class HandlerInvoiceAssociationChange {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationCreation: HandlerOrganizationCreation,
    private readonly invoiceCreation: HandlerInvoiceCreation,
  ) {}

  async execute(event) {
    let organization;
    let invoice;
    let eventInvoice;
    switch (event.associationType) {
      case 'COMPANY_TO_INVOICE':
        //fromObjectId => company/organization
        //toObjectId => invoice

        organization = await this.prisma.organization.findUnique({
          where: {
            hubspot_id: String(event.fromObjectId),
          },
          select: {
            id: true,
          },
        });

        //If the organization is not found, we create it
        if (!organization) {
          await this.organizationCreation.execute(event);
          organization = await this.prisma.organization.findUnique({
            where: {
              hubspot_id: String(event.fromObjectId),
            },
            select: {
              id: true,
            },
          });
        }
        if (!organization) return;

        invoice = await this.prisma.hubspotInvoiceSnapshot.findUnique({
          where: {
            hubspot_id: String(event.toObjectId),
          },
          select: {
            id: true,
          },
        });
        eventInvoice = { ...event, objectId: event.toObjectId };
        if (!invoice) {
          const newInvoice = await this.invoiceCreation.execute(eventInvoice);
          if (!newInvoice) {
            console.log(
              'Impossible to create invoice from invoiceCreation handler | Maybe this invoice is not in the right rule',
            );
            return;
          }
        }

        await this.prisma.hubspotInvoiceSnapshot.update({
          where: {
            hubspot_id: String(event.toObjectId),
          },
          data: {
            organization_id: organization.id,
          },
        });
        break;

      case 'INVOICE_TO_COMPANY':
        //Here I'll invert the datas, but keep the same logic
        organization = await this.prisma.organization.findUnique({
          where: {
            hubspot_id: String(event.toObjectId),
          },
          select: {
            id: true,
          },
        });

        //If the organization is not found, we create it
        if (!organization) {
          await this.organizationCreation.execute(event);
          organization = await this.prisma.organization.findUnique({
            where: {
              hubspot_id: String(event.toObjectId),
            },
            select: {
              id: true,
            },
          });
        }
        if (!organization) return;

        invoice = await this.prisma.hubspotInvoiceSnapshot.findUnique({
          where: {
            hubspot_id: String(event.fromObjectId),
          },
          select: {
            id: true,
          },
        });
        eventInvoice = { ...event, objectId: event.fromObjectId };
        if (!invoice) {
          const newInvoice = await this.invoiceCreation.execute(eventInvoice);
          if (!newInvoice) {
            console.log(
              'Impossible to create invoice from invoiceCreation handler | Maybe this invoice is not in the right rule',
            );
            return;
          }
        }

        await this.prisma.hubspotInvoiceSnapshot.update({
          where: {
            hubspot_id: String(event.fromObjectId),
          },
          data: {
            organization_id: organization.id,
          },
        });

        break;
    }

    return true;
  }
}
