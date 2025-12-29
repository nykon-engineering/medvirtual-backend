import { Injectable } from "@nestjs/common";
import axios from "axios";
import { dbToHrTicketDictionary } from "../../common/dictionaries/HRTicket-dicionary";
import { PrismaService } from "../../prisma/prisma.service";
import { OwnerCreationService } from "../create/Owner";

@Injectable()

export class HireRequestUpdateService {
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

    async execute(data: any, specificField?: string): Promise<any> {
        try {

            const hubspotProperties: Record<string, any> = {};

            if (specificField) {
              switch (specificField) {
                case 'assign_user_id':
                hubspotProperties.hubspot_owner_id = data.assign_user_id ? await this.getOwnerId(data.assign_user_id) : undefined;
                break;

                case 'assign_sourcing_id':
                hubspotProperties.pairing_specialist = data.assign_sourcing_id ? await this.getOwnerId(data.assign_sourcing_id) : undefined;
                break;

                case 'closed_date':
                hubspotProperties.closed_date = new Date().toISOString();
                break;

                case 'cancel_date':
                hubspotProperties.ticket_cancel_date = new Date().toISOString().split("T")[0]; //YYYY-MM-DD
                break;
              }
              
            }else{
              //fields came from Hire Request Update Page
              for (const [dbKey, hubspotKey] of Object.entries(dbToHrTicketDictionary)) {
                if (data[dbKey] !== undefined && data[dbKey] !== null) {
                  hubspotProperties[hubspotKey] = data[dbKey];
                }
              }

              hubspotProperties.va_deployment_type = 
                  data.availability ?
                    data.availability === "part-time" ? "Part-Time" : "Full-Time"
                  : undefined;
                  //find key by value in HRTicketStatus
              hubspotProperties.hs_ticket_priority = 
                data.priority ?
                  data.priority.toUpperCase()
                : undefined;

              hubspotProperties.special_sourcing_needed =
                  data.hubspot_special_sourcing_needed ?
                    data.hubspot_special_sourcing_needed === 'Yes' ? 'true' : 'false'
                  : undefined;

              //used to allow update datas on hubspot when the user schedule an interview on our side
              hubspotProperties.pairing_date = 
                data.hubspot_pairing_date ?
                  data.hubspot_pairing_date
                : undefined;

              hubspotProperties.pairing_time =
                data.hubspot_pairing_time ?
                  data.hubspot_pairing_time
                : undefined;
              
              hubspotProperties.va_pay_rate_range = data.salary_range_from && data.salary_range_to 
              ? `${data.salary_range_from} - ${data.salary_range_to}`
              : '';

            }
            
            
            //console.log(hubspotProperties)
            const response = await axios.patch(
            `https://api.hubapi.com/crm/v3/objects/tickets/${Number(data.hubspot_ticket_id)}`,
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
      
          //console.log(response.data);
          
          return true;
        } catch (error) {
          if (error.response) {
            console.error("Error to created ticket:", error.response.data);
          } else {
            console.error("Connection error:", error.message);
          }
        }
        
    }
}