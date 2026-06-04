import { BadRequestException, Injectable } from '@nestjs/common';
import axios from 'axios';

import { PrismaService } from '../../prisma/prisma.service';
import { AffiliateStatus } from '@prisma/client';
import { affiliateToDbDictionary } from '../../common/dictionaries/affiliate-dictionary';

@Injectable()
export class HandlerAffiliateCreation {
  constructor(private readonly prisma: PrismaService) {}

  async execute(event) {
    //On 2026-04-30 we decided:
    //1. Create affiliates only if they are in the "Alliance Partner Pipeline" (hs_pipeline_stage: 1329693870)
    //2. If the affiliate already exists, we skip creation (this can happen if the pipeline stage is changed back and forth)
    //3. If the affiliate is associated with a contact that has a user, we link the affiliate to that user (this allows us to send them notifications and emails from our system)
    //4. We wont create contact or user records for the affiliate. because we have a 'invite user' function on affiliate modal in the frontend;
    try {
      if (event.changeSource === 'INTEGRATION') {
        console.log('Skipping event from integration source:', event);
        return true; // Skip processing for events originating from integrations
      }
      const properties = Object.keys(affiliateToDbDictionary).join(',');
      const getObject = await axios.get(
        `https://api.hubapi.com/crm/v3/objects/${process.env.HUBSPOT_GROWTH_PARTNER_CUSTOM_OBJECT}/${event.objectId}?properties=${properties}&associations=contacts`,
        {
          headers: {
            Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      );
      if (!getObject.data) {
        throw new BadRequestException('No object data found');
      }
      console.log('Fetched object data from HubSpot:', getObject.data);
      const rawProperties = getObject.data.properties;

      if (rawProperties.hs_pipeline_stage !== '1329693870') {
        // 1329693870 is the Alliance Partner Pipeline
        return true; // Not qualified, let's skip creation
      }

      const existingAffiliate = await this.prisma.affiliateProfile.findUnique({
        where: {
          hubspot_id: rawProperties.hs_object_id,
        },
        select: {
          id: true,
        },
      });

      if (existingAffiliate) {
        return true; // Affiliate already exists, let's skip creation
      }

      let userId: string | null = null;
      let contactId: string | null = null;
      const associatedContact =
        getObject.data.associations?.contacts?.results?.[0];

      if (associatedContact) {
        const contact = await this.prisma.contact.findUnique({
          where: {
            hubspot_id: String(associatedContact.id),
          },
          include: {
            user: true,
          },
        });

        if (contact) {
          contactId = contact.id;
          if (contact.user) {
            userId = contact.user.id;
          }
        }
      }

      const affiliateData: any = {
        full_name: rawProperties.growth_partner_name,
        hubspot_id: rawProperties.hs_object_id,
        commission_percent_default: 7.0,
        status: AffiliateStatus.active,
      };

      if (userId) {
        affiliateData.user = { connect: { id: userId } };
      }

      if (contactId) {
        affiliateData.contact = { connect: { id: contactId } };
      }

      await this.prisma.affiliateProfile.create({
        data: affiliateData,
      });

      return true;
    } catch (error) {
      console.error(
        'Error processing HubSpot affiliate creation event:',
        error,
      );
      throw new BadRequestException(
        `Error fetching object creation data: ${error.message}`,
      );
    }
  }
}
