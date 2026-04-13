import { Injectable } from "@nestjs/common";
import axios from "axios";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()

export class OrganizationCreationService {
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

      /* => Commented because we cannot create owners using hubspot API
      if (user && !user.hubspot_id) {
      await this.ownerCreationService.execute(user)
      }
      */

      return user && user.hubspot_id ? user.hubspot_id : null; 
    }

    async getAfiliateId(affiliateId: string): Promise<string | null> {
      if (!affiliateId) return null;
      const affiliate = await this.prisma.affiliateProfile.findUnique({
        where: { user_id: affiliateId },
        select: {
          hubspot_id: true,
        },
      });
      return affiliate && affiliate.hubspot_id ? affiliate.hubspot_id : null; 
    }

    async execute(data: any): Promise<any> {
       try {

          const response = await axios.post(
            "https://api.hubapi.com/crm/v3/objects/companies",
            {
              properties: {
                name: data.name,
                about_us: data.description,
                address: data.address,
                city: data.city,
                state: data.state || '',
                zip: data.postal_code || '',
                country: data.location || '',
                domain: data.website_url || '',
                description: data.description || '',
                //industry: data.industry || '',
                numberofemployees: Number(data.number_of_employees),
                phone: data.phone || '',
                referral_email: data.email || '',
                type: data.type || '',
                business_unit: data.business_unit === 'Med Virtual' ? 'MedVirtual' : data.business_unit || '',
                hubspot_owner_id: data.admin_id ? await this.getOwnerId(data.admin_id) : undefined,
              },
              associations: data.referred_by_affiliate_id ? [
                {
                  to: { id: await this.getAfiliateId(data.referred_by_affiliate_id) }, 
                  types: [
                    {
                      associationCategory: "USER_DEFINED",
                      associationTypeId: 118, // 118 = association company → growth Partner (affiliate)
                    },
                  ],
                },
              ]
              : undefined,
            },
            {
              headers: {
                Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
              },
            }
          );
      
          //onsole.log(' Response: ',response.data);
          //update hireRequest with the hubspot_ticket_id
          await this.prisma.organization.update({
            where: { id: data.id },
            data: { hubspot_id: response.data.id },
          });
          
          return true;
        
        } catch (error) {
          if (error.response) {
            console.error("Error to created organization:", error.response.data);
          } else {
            console.error("Connection error:", error.message);
          }
        }
        
    }
}