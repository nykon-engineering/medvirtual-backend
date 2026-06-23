import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HandlerOrganizationCreation } from './organizationCreation';
import { organizationToDbDictionary } from '../../common/dictionaries/organization-dictionary';
import { HandlerOrganizationDeletion } from './organizationDeletion';
import { OrganizationRole } from '@prisma/client';
import { organizationIndustryToDbDictionary } from '../../common/dictionaries/organizationIndustry-dictionary';

@Injectable()
export class HandlerOrganizationPropertyChange {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationCreation: HandlerOrganizationCreation,
    private readonly organizationDeletion: HandlerOrganizationDeletion,
  ) {}

  async execute(event) {
    let owner;
    const organization = await this.prisma.organization.findUnique({
      where: {
        hubspot_id: String(event.objectId),
      },
    });

    //Here I dont need to check if the organization is a client of MedVirtual, because inside the organizationCreation handler it already does that
    if (!organization) return await this.organizationCreation.execute(event);

    //Here I need to delete the organization if the business_unit property is changed to a value different than MedVirtual
    if (
      organization &&
      event.propertyName === 'business_unit' &&
      event.propertyValue !== 'MedVirtual' &&
      organization &&
      event.propertyName === 'business_unit' &&
      event.propertyValue !== 'Berry Virtual'
    )
      return await this.organizationDeletion.execute(event);

    const fieldExists = Object.keys(organizationToDbDictionary).includes(
      event.propertyName,
    );
    if (!fieldExists && event.propertyName !== 'hubspot_owner_id') return;

    const fieldUpdated = organizationToDbDictionary[event.propertyName];
    let value = event.propertyValue;

    if (fieldUpdated === 'organization_role') {
      if (event.propertyValue.toLowerCase() === 'prospect') {
        value = OrganizationRole.prospect;
      } else {
        value = OrganizationRole.client;
      }
    }

    if (fieldUpdated === 'industry') {
      value = event.propertyValue
        ? (organizationIndustryToDbDictionary[event.propertyValue] ?? '')
        : '';
    }

    if (fieldUpdated === 'specialties') {
      value = event.propertyValue
        ?.split(',')
        .map((item: string) => item.trim())
        .filter((item: string) => item.length > 0);
    }

    if (fieldUpdated === 'number_of_employees') {
      value = event.propertyValue ? Number(event.propertyValue) : null;
    }

    if (fieldUpdated === 'deployment_date') {
      value = event.propertyValue
        ? new Date(Number(event.propertyValue))
        : null;
    }

    if (event.propertyName === 'hubspot_owner_id') {
      //check if the owner exists in the system
      owner = await this.prisma.uSER.findUnique({
        where: {
          hubspot_id: String(event.propertyValue),
        },
        select: {
          id: true,
        },
      });

      if (owner) {
        //if owner exists, update the organization admin with the new owner
        await this.prisma.organization.update({
          where: {
            id: organization.id,
          },
          data: {
            admin: { connect: { id: owner.id } },
          },
        });
      }
      return true;
    }

    if (event.propertyName !== 'hubspot_owner_id') {
      await this.prisma.organization.update({
        where: {
          id: organization.id,
        },
        data: {
          [fieldUpdated]: value,
        },
      });
    }

    if (fieldUpdated === 'deployment_date') {
      const fullOrg = await this.prisma.organization.findUnique({
        where: { id: organization.id },
        select: { referred_by_affiliate_id: true },
      });

      if (!fullOrg?.referred_by_affiliate_id) return true;

      const now = new Date();
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

      if (value === null) {
        // deployment_date cleared — revert to referred/not_eligible
        await this.prisma.organization.update({
          where: { id: organization.id },
          data: {
            referral_stage: 'referred' as any,
            med_alliance_referral_status: 'not_eligible',
            eligibility_start_at: null,
            med_alliance_block_reason: null,
          },
        });
      } else {
        const deployDate = value as Date;
        const eligibilityStartAt = new Date(
          deployDate.getTime() + THIRTY_DAYS_MS,
        );

        if (deployDate > now) {
          // Future date: revert to referred/not_eligible
          await this.prisma.organization.update({
            where: { id: organization.id },
            data: {
              referral_stage: 'referred' as any,
              med_alliance_referral_status: 'not_eligible',
              eligibility_start_at: null,
              med_alliance_block_reason: null,
            },
          });
        } else if (now.getTime() - deployDate.getTime() >= THIRTY_DAYS_MS) {
          // 30+ days ago: deployed + pending_confirmation (admin must confirm)
          await this.prisma.organization.update({
            where: { id: organization.id },
            data: {
              referral_stage: 'deployed' as any,
              med_alliance_referral_status: 'pending_confirmation' as any,
              eligibility_start_at: eligibilityStartAt,
              med_alliance_block_reason: null,
            },
          });
        } else {
          // Today or < 30 days ago: deployed + not_eligible (cron promotes after 30 days)
          await this.prisma.organization.update({
            where: { id: organization.id },
            data: {
              referral_stage: 'deployed' as any,
              med_alliance_referral_status: 'not_eligible',
              eligibility_start_at: eligibilityStartAt,
              med_alliance_block_reason: null,
            },
          });
        }

        await this.prisma.medAllianceAuditLog.create({
          data: {
            entity_type: 'referred_company',
            entity_id: organization.id,
            event: 'eligibility_pending_confirmation',
            old_status: null,
            new_status: 'pending_confirmation',
            reason:
              'deployment_date synced from HubSpot deploy_date_of_first_va — 30+ days elapsed',
            source: 'sync',
            actor_user_id: null,
            metadata: {
              deployment_date: deployDate.toISOString(),
              eligibility_start_at: eligibilityStartAt.toISOString(),
            } as any,
          },
        });
      }
    }

    return true;
  }
}
