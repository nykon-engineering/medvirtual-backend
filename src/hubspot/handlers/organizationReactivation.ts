import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrganizationStatus } from '@prisma/client';

interface OrganizationPropertyChangeEvent {
  objectId: string | number;
  propertyName: string;
  propertyValue: string;
}

@Injectable()
export class HandlerOrganizationReactivation {
  constructor(private readonly prisma: PrismaService) {}

  async execute(event: OrganizationPropertyChangeEvent) {
    try {
      const organizationExists = await this.prisma.organization.findUnique({
        where: {
          hubspot_id: String(event.objectId),
        },
        select: {
          id: true,
          status: true,
        },
      });
      if (!organizationExists) return;
      if (organizationExists.status !== OrganizationStatus.deleted) return;

      // Reactivated orgs go to `inactive`, NOT `active` — same rule as
      // organizationCreation: a human (or a deal/staff event) must activate.
      await this.prisma.organization.update({
        where: {
          id: organizationExists.id,
        },
        data: {
          status: OrganizationStatus.inactive,
          deletedAt: null,
          business_unit: event.propertyValue,
        },
      });
    } catch (error) {
      throw new BadRequestException('Error reactivating organization', error);
    }
  }
}
