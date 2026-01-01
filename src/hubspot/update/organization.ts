import { Injectable } from "@nestjs/common";
import axios from "axios";
import { dbToHrTicketDictionary } from "../../common/dictionaries/HRTicket-dicionary";
import { PrismaService } from "../../prisma/prisma.service";
import { OwnerCreationService } from "../create/Owner";

@Injectable()

export class OrganizationUpdateService {
    constructor(
      private readonly prisma: PrismaService,
      private readonly ownerCreationService: OwnerCreationService
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

    async execute(data: any): Promise<any> {
        try {
            const hubspotProperties: Record<string, any> = {};
            //We are using just hubspot_owner_id because it's the only field that we need to update in hire request for now
            hubspotProperties.hubspot_owner_id = data.admin.id ? await this.getOwnerId(data.admin.id) : undefined;
            
            
            //console.log(hubspotProperties)
            const response = await axios.patch(
            `https://api.hubapi.com/crm/v3/objects/companies/${Number(data.hubspot_id)}`,
            {
              properties: hubspotProperties
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
            console.error("Error to update organization:", error.response.data);
          } else {
            console.error("Connection error:", error.message);
          }
        }
        
    }
}