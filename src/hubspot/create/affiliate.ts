import { BadRequestException, Injectable } from "@nestjs/common";
import axios from "axios";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()

export class AffiliateCreationService {
    constructor(
      private readonly prisma: PrismaService
    ){}

    async getOwnerId(userId: string): Promise<string | null> {
      if (!userId) return null;
      const user = await this.prisma.uSER.findUnique({
      where: { id: userId },
      select: {
          id: true,
          hubspot_id: true,
          first_name: true,
          last_name: true,
          email: true,
      },

      });

      return user && user.hubspot_id ? user.hubspot_id : null;
    }

    async createContactAndLinkToGrowthPartner(
      userId: string,
      firstName: string,
      lastName: string,
      email: string,
      growthPartnerHubspotId: string | null,
      phone?: string,
      companyName?: string,
    ): Promise<void> {
      try {
        const contactId = await this.ensureContact(userId, firstName, lastName, email, null, phone, companyName);
        if (contactId && growthPartnerHubspotId) {
          await axios.put(
            `https://api.hubapi.com/crm/v4/objects/p20630393_growth_partners/${growthPartnerHubspotId}/associations/contacts/${contactId}`,
            [{ associationCategory: 'USER_DEFINED', associationTypeId: 119 }],
            {
              headers: {
                Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
              },
            },
          );
        }
      } catch (error) {
        console.error('[HubSpot] Failed to create contact / link to growth partner:', error?.response?.data ?? error?.message);
      }
    }

    private async ensureContact(
      userId: string,
      firstName: string,
      lastName: string,
      email: string,
      existingContactId: string | null,
      phone?: string,
      companyName?: string,
    ): Promise<string | null> {
      if (existingContactId) {
        // Update existing contact with Referral qualification and lead source
        await axios.patch(
          `https://api.hubapi.com/crm/v3/objects/contacts/${existingContactId}`,
          {
            properties: {
              qualification_status: 'Referral',
              latest_lead_source: 'Referral',
            },
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
              "Content-Type": "application/json",
            },
          },
        );
        return existingContactId;
      }

      const response = await axios.post(
        "https://api.hubapi.com/crm/v3/objects/contacts",
        {
          properties: {
            firstname: firstName,
            lastname: lastName,
            email: email,
            phone: phone ?? '',
            company: companyName ?? '',
            qualification_status: 'Referral',
            latest_lead_source: 'Referral',
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );

      const contactId: string = response.data.id;

      await this.prisma.uSER.update({
        where: { id: userId },
        data: { hubspot_contact_id: contactId },
      });

      // Sync hubspot_id back to DB Contact if one was created for this user
      await this.prisma.contact.updateMany({
        where: { user_id: userId, hubspot_id: null },
        data: { hubspot_id: contactId },
      });

      return contactId;
    }

    async execute(data: any): Promise<any> {
        try {
          const contactHubspotId = await this.ensureContact(
            data.user.id,
            data.user.first_name,
            data.user.last_name,
            data.user.email,
            data.user.hubspot_contact_id ?? null,
            data.user.phone ?? undefined,
            data.user.contact?.company_name ?? undefined,
          );

          const associations: { to: { id: number }; types: { associationCategory: string; associationTypeId: number }[] }[] = [];

          if (contactHubspotId) {
            associations.push({
              to: { id: Number(contactHubspotId) },
              types: [{ associationCategory: "USER_DEFINED", associationTypeId: 119 }],
            });
          }

          if (data.user.organization?.hubspot_id) {
            associations.push({
              to: { id: Number(data.user.organization.hubspot_id) },
              types: [{ associationCategory: "USER_DEFINED", associationTypeId: 117 }],
            });
          }

          const response = await axios.post(
            "https://api.hubapi.com/crm/v3/objects/p20630393_growth_partners",
            {
              properties: {
                growth_partner_name: data.user.first_name + ' ' + data.user.last_name,
                growth_partner_email_address: data.user.email,
                hs_pipeline: '883841953',
                hs_pipeline_stage: data.status === 'invited'? '1329066003' : '1329693870', //if invited, set to "Prospect", otherwise set to "Active"
                business_unit: data.user.organization?.business_unit,
                growth_partner_company_name: data.user.organization?.name,
                alliance_commission: 7,
                attribution_information: 'Alliance Partner',
                earning_status: 'Active',
                hubspot_owner_id: data.created_by ? await this.getOwnerId(data.created_by) : null,
                referral_role: 'Alliance Partner',
              },
              associations: associations.length ? associations : undefined,
            },
            {
              headers: {
                Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
              },
            }
          );

          await this.prisma.affiliateProfile.update({
            where: { id: data.id },
            data: { hubspot_id: response.data.id },
          });

          return true;
        } catch (error) {
          if (error.response) {
            console.error("Error creating affiliate:", error.response.data);
            throw new BadRequestException('Failed to create Growth Partner in Hubspot. Your affiliate profile has not been created. Please try again later.');
          } else {
            console.error("Connection error:", error.message);
            throw new BadRequestException('Failed to create Growth Partner in Hubspot. Your affiliate profile has not been created. Please try again later.');
          }
        }

    }
}
