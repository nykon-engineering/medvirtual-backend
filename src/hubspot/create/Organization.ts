import { Injectable } from "@nestjs/common";
import axios from "axios";
import { PrismaService } from "../../prisma/prisma.service";
import { getOwnerId } from "../../common/utils/getOwnerId";

@Injectable()

export class OrganizationCreationService {
    constructor(
      private readonly prisma: PrismaService
    ){}

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
                business_unit: data.business_unit || '',
                hubspot_owner_id: data.admin_id ? await getOwnerId(data.admin_id) : undefined,
              },
              associations:[]
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