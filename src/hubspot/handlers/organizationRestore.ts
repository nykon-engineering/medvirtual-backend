import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrganizationStatus } from '@prisma/client';
import { HandlerOrganizationCreation } from './organizationCreation';

@Injectable()
export class HandlerOrganizationRestore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationCreation: HandlerOrganizationCreation,
  ) {}

  /**
   * Handles `company.restore` — a company that was archived in HubSpot is
   * un-archived. The organization already exists on our side (soft-deleted by
   * the company.deletion webhook), so it must be updated in place: recreating it
   * would either fail on the unique hubspot_id or orphan the Med Alliance
   * referral history attached to the existing row.
   *
   * Falls back to the creation handler only when the company was never synced.
   */
  async execute(event) {
    try {
      const organization = await this.prisma.organization.findUnique({
        where: {
          hubspot_id: String(event.objectId),
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!organization) return await this.organizationCreation.execute(event);

      if (organization.status !== OrganizationStatus.deleted) return;

      // Restored orgs go to `inactive`, NOT `active` — same rule as
      // organizationCreation: a human (or a deal/staff event) must activate.
      await this.prisma.organization.update({
        where: {
          id: organization.id,
        },
        data: {
          status: OrganizationStatus.inactive,
          deletedAt: null,
        },
      });
    } catch (error) {
      throw new BadRequestException('Error restoring organization', error);
    }
  }
}
