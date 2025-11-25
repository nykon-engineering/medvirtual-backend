import { Injectable } from "@nestjs/common";
import axios from "axios";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()

export class HireRequestCreationService {
    constructor(
      private readonly prisma: PrismaService
    ){}

    async execute(data: any): Promise<any> {
        try {
          const pay_range= data.salary_range_from && data.salary_range_to 
          ? `${data.salary_range_from} - ${data.salary_range_to}` 
          : '';
          
          const response = await axios.post(
            "https://api.hubapi.com/crm/v3/objects/tickets",
            {
              properties: {
                subject: data.title,
                content: data.description,
                hs_pipeline: "0", //=>Pairing Pipeline
                hs_pipeline_stage: "1",  //=> New agent Request
                pairing_request_type: data.hubspot_pairing_request_type || 'New Client',
                ticket_type: "Agent Pairing Request",
                business_unit: data.organization.business_unit || "Not Specified",
                company_name: data.organization.name,
                client_name: data.organization.name,
                company_url: data.organization.website_url || "Not Specified",
                va_deployment_type: data.availability === "part-time" ? "Part-Time" : "Full-Time",
                hs_ticket_priority: data.priority.toUpperCase(),
                va_type: data.hubspot_role_type,
                contract_amount: data.hubspot_contract_amount,
                language: data.hubspot_language,
                number_of_vas: data.hubspot_numberVA.toString(),
                va_pay_rate_range: pay_range.toString(),
                tasks: data.hubspot_tasks,
                n2_monitors_required_: data.hubspot_n2_monitors_required,
                va_shift_hours: data.hubspot_va_shift_hours,
                special_sourcing_needed: data.hubspot_special_sourcing_needed === 'Yes' ? 'true' : 'false',
                special_requirements: data.hubspot_special_requirements,
                additional_training_requested: data.hubspot_additional_training_requested,
                pairing_date: data.hubspot_pairing_date,
                pairing_time: data.hubspot_pairing_time,
                //hire_date__start_of_employment_: PairingDate, 'expected_start_date', => issue form hubspot saying 'Enter a date before ${currentDate}': 
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