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

    async execute(data: any): Promise<any> {
        try {
          const response = await axios.post(
            "https://api.hubapi.com/crm/v3/objects/p20630393_growth_partners",
            {
              properties: {
                
                growth_partner_name: data.user.first_name + ' ' + data.user.last_name,
                growth_partner_email_address: data.user.email,
                hs_pipeline: '883841953',
                hs_pipeline_stage: '1329693870',
                business_unit: data.user.organization?.business_unit,
                growth_partner_company_name: data.user.organization?.name,
                alliance_commission: 7,
                attribution_information: 'Alliance Partner',
                earning_status: 'Active',
                hubspot_owner_id: data.created_by ? await this.getOwnerId(data.created_by) : null,
                referral_role: 'Alliance Partner',
              },
              associations: data.user.organization?.hubspot_id ? [
                {
                  to: { id: Number(data.user.organization.hubspot_id) }, 
                  types: [
                    {
                      associationCategory: "USER_DEFINED",
                      associationTypeId: 117, // 117 = Growth Partner → organization
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
          await this.prisma.affiliateProfile.update({
            where: { id: data.id },
            data: { hubspot_id: response.data.id },
          });
          
          return true;
        } catch (error) {
          if (error.response) {
            console.error("Error to created Affiliate:", error.response.data);
            throw new BadRequestException('Failed to create Growth Partner in Hubspot. Your affiliate profile has not been created. Please try again later.');
          } else {
            console.error("Connection error:", error.message);
            throw new BadRequestException('Failed to create Growth Partner in Hubspot. Your affiliate profile has not been created. Please try again later.');
          }
        }
        
    }
}