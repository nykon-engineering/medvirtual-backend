import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HandlerAffiliateAssociationChange {
  constructor(private readonly prisma: PrismaService) {}

  async execute(event): Promise<void> {
    // associationTypeId 119: Growth Partner → Contact (fromObjectId = GP, toObjectId = Contact)
    // associationTypeId 120: Contact → Growth Partner (fromObjectId = Contact, toObjectId = GP)
    const gpHubspotId =
      event.associationTypeId === '119'
        ? String(event.fromObjectId)
        : String(event.toObjectId);
    const contactHubspotId =
      event.associationTypeId === '119'
        ? String(event.toObjectId)
        : String(event.fromObjectId);

    const [affiliate, contact] = await Promise.all([
      this.prisma.affiliateProfile.findUnique({
        where: { hubspot_id: gpHubspotId },
        select: { id: true, contact_id: true },
      }),
      this.prisma.contact.findUnique({
        where: { hubspot_id: contactHubspotId },
        select: { id: true },
      }),
    ]);

    if (!affiliate || !contact) return;
    if (affiliate.contact_id === contact.id) return;

    await this.prisma.affiliateProfile.update({
      where: { id: affiliate.id },
      data: { contact_id: contact.id },
    });
  }
}
