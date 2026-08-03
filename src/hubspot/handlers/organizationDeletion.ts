import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrganizationStatus } from '@prisma/client';
import { getNowInTimezone } from '../../common/utils/formatDate';
import { OrgDeletionService } from '../../med-alliance/org-deletion/org-deletion.service';

@Injectable()
export class HandlerOrganizationDeletion {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgDeletion: OrgDeletionService,
  ) {}

  async execute(event) {
    try {
      const organizationExists = await this.prisma.organization.findUnique({
        where: {
          hubspot_id: String(event.objectId),
        },
        select: {
          id: true,
        },
      });
      if (!organizationExists) return;

      await this.prisma.uSER.updateMany({
        where: {
          organization_id: organizationExists.id,
        },
        data: {
          status: 'inactive',
        },
      });

      // When the deletion is triggered by a business_unit change (org moved to a
      // BU that is not visible on our side), persist the NEW business_unit too so
      // the DB keeps reflecting HubSpot and BU-activation reactivation — which
      // matches deleted orgs by business_unit — can bring the org back.
      // For a real company deletion, propertyName is NOT 'business_unit' and
      // propertyValue is not a BU, so we must leave business_unit untouched.
      const isBusinessUnitTrigger =
        event?.propertyName === 'business_unit' &&
        typeof event.propertyValue === 'string' &&
        event.propertyValue.length > 0;

      await this.prisma.organization.update({
        where: {
          id: organizationExists.id,
        },
        data: {
          status: OrganizationStatus.deleted,
          deletedAt: getNowInTimezone('UTC'),
          ...(isBusinessUnitTrigger
            ? { business_unit: event.propertyValue }
            : {}),
        },
      });

      // Med Alliance side effects: void unrequested commissions, open a review
      // case for commissions in pending payouts, close stale review cases,
      // write audit trail and notify admins. No-op for non-referred orgs.
      await this.orgDeletion.onOrganizationDeleted(organizationExists.id);
    } catch (error) {
      throw new BadRequestException('Error deleting organization', error);
    }
  }
}
