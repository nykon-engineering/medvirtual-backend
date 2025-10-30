import { Injectable } from "@nestjs/common";
import axios from "axios";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()

export class HireRequestCreationService {
    constructor(
      private readonly prisma: PrismaService
    ){}

    async execute(data: any): Promise<any> {
      console.log("Creating Hire Request Ticket in HubSpot...");
        try {
          

          const expectedDate = new Date(data.expected_start_date);
          const PairingDate = expectedDate.getFullYear() +'-'+ (expectedDate.getMonth() + 1) +'-'+ expectedDate.getDate();
          const hours = String(expectedDate.getHours()).padStart(2, "0");
          const minutes = String(expectedDate.getMinutes()).padStart(2, "0");
          const seconds = String(expectedDate.getSeconds()).padStart(2, "0");
          const PairingTime = `${hours}:${minutes}:${seconds}`;
          
          const response = await axios.post(
            "https://api.hubapi.com/crm/v3/objects/tickets",
            {
              properties: {
                subject: data.title,
                content: data.description,
                hs_pipeline: "0", //=>Pairing Pipeline
                hs_pipeline_stage: "1",  //=> New agent Request
                pairing_request_type: "New Client",
                ticket_type: "Agent Pairing Request",
                business_unit: data.organization.business_unit || "Not Specified",
                company_name: data.organization.name,
                company_url: data.organization.website_url || "Not Specified",
                va_deployment_type: data.availability === "part-time" ? "Part-Time" : "Full-Time",
                hs_ticket_priority: data.priority.toUpperCase(),
                va_type: data.hubspot_role_type,
                contract_amount: data.hubspot_contract_amount,
                language: data.hubspot_language,
                number_of_vas: data.hubspot_numberVA.toString(),
                pairing_date: PairingDate,
                pairing_time: PairingTime,
              },
              associations: [
                {
                  to: { id: data.organization.hubspot_id }, 
                  types: [
                    {
                      associationCategory: "HUBSPOT_DEFINED",
                      associationTypeId: 26, // 26 = association ticket → organization
                    },
                  ],
                },
              ],
            },
            {
              headers: {
                Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
              },
            }
          );
      
          //console.log(response.data);
          //update hireRequest with the hubspot_ticket_id
          await this.prisma.hireRequest.update({
            where: { id: data.id },
            data: { hubspot_ticket_id: response.data.id },
          });
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