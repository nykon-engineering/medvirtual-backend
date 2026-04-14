import { Injectable } from "@nestjs/common";
import axios from "axios";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()

export class ContactFromCompanyCreationService {
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
      // In this case we will use majority datas from organizations to create the contact
      //console.log(data)
        try {
          const response = await axios.post(
            "https://api.hubapi.com/crm/v3/objects/contacts",
            {
              properties: {
                account_type: data.business_unit 
                  ? data.business_unit === 'Med Virtual' 
                    ? 'Med Virtual'
                    : 'Berry Virtual'
                  : "Med Virtual", //business_unit
                firstname: data.contact_first_name,
                lastname: data.contact_last_name,
                email: data.email ?? data.contact_email, //email
                phone: data.phone || '',
                website: data.website_url || '',
                jobtitle: data.job_title || '',
                business_unit: data.business_unit === 'Med Virtual' ? 'MedVirtual' : 'Berry Virtual',
                company: data.name || '',
                hubspot_owner_id: data.admin_id ? await this.getOwnerId(data.admin_id) : undefined,
                demo_owner: data.admin_id ? await this.getOwnerId(data.admin_id) : undefined,
                title: data.contact_first_name + ' ' + data.contact_last_name,

                //starting with referral information
                account_name: data.referredByAffiliate.affiliateProfile ? data.referredByAffiliate.affiliateProfile.full_name: undefined,
                account_number: data.referredByAffiliate.affiliateProfile ? data.referredByAffiliate.affiliateProfile.hubspot_id : undefined,
                alliance_commission: data.referredByAffiliate.affiliateProfile.commission_percent_default || 7,
                growth_partner_company_name: data.referredByAffiliate.organization ? data.referredByAffiliate.organization.name : undefined,
                growth_partner_email_address: data.referredByAffiliate.organization ? data.referredByAffiliate.organization.email : undefined,
                preferred_payment_method: data.referredByAffiliate.affiliateProfile ? data.referredByAffiliate.affiliateProfile.preferred_payment_method : undefined,
                referral_partner: data.referredByAffiliate.affiliateProfile ? data.referredByAffiliate.affiliateProfile.full_name : undefined, //Name of the client who referred this deal.
                referral_partners_email: data.referredByAffiliate ? data.referredByAffiliate.email : undefined, //Email of the client who referred this deal.
                referral_source: 'Referral - Partner',
                referrals_industry: data.business_unit === 'Med Virtual' ? 'Medical' : 'Non-Medical',
                referred_to: data.referToUser?.id ? await this.getOwnerId(data.referToUser.id) : '',
              },
              // 2 Associations: 
              // contact → organization (if the org already exists in HubSpot)
              // contact → growth partner
              associations:  [
                data.hubspot_id ? {
                  to: { id: data.hubspot_id }, // This is the hubspot_id of the organization that we created in the previous step in the same service
                  types: [
                    {
                      associationCategory: "HUBSPOT_DEFINED",
                      associationTypeId: 279, // 279 = association contact → organization
                    },
                  ],
                } : undefined,
                data.referredByAffiliate.affiliateProfile && data.referredByAffiliate.affiliateProfile.hubspot_id ? {
                  to: { id: data.referredByAffiliate.affiliateProfile.hubspot_id }, 
                  types: [
                    {
                      associationCategory: "USER_DEFINED",
                      associationTypeId: 120, // 120 = association contact → growth partner (custom object p20630393_growth_partners)
                    },
                  ],
                } : undefined,
              ]
            },
            {
              headers: {
                Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
              },
            }
          );
         
          return true;
        } catch (error) {
          if (error.response) {
            console.error("Error to created contact from company:", error.response.data);
          } else {
            console.error("Connection error:", error.message);
          }
        }
        
    }
}