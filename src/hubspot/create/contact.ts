import { Injectable } from "@nestjs/common";
import axios from "axios";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()

export class ContactCreationService {
    constructor(
      private readonly prisma: PrismaService
    ){}


    async execute(data: any): Promise<any> {
        try {
          const response = await axios.post(
            "https://api.hubapi.com/crm/v3/objects/contacts",
            {
              properties: {
                account_type: data.organization.business_unit 
                  ? data.organization.business_unit === 'MedVirtual' 
                    ? 'Med Virtual'
                    : data.organization.business_unit
                  : "Not Specified", //business_unit
                firstname: data.first_name,
                lastname: data.last_name,
                email: data.email,
                phone: data.phone || '',
                jobtitle: data.job_title || '',

              },
              associations: data.organization.hubspot_id ? [
                {
                  to: { id: data.organization.hubspot_id }, 
                  types: [
                    {
                      associationCategory: "HUBSPOT_DEFINED",
                      associationTypeId: 279, // 279 = association contact → organization
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
         
          return true;
        } catch (error) {
          if (error.response) {
            console.error("Error to created contact:", error.response.data);
          } else {
            console.error("Connection error:", error.message);
          }
        }
        
    }
}