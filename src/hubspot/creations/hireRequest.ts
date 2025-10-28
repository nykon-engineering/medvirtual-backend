import { Injectable } from "@nestjs/common";
import axios from "axios";

@Injectable()

export class HireRequestCreationService {
    constructor(){}

    async createHireRequest(data: any): Promise<any> {
        try {
            const content = `CLIENTS NAME : ${data.organization.name}\n\nBUSINESS NAME: \n\nNATURE OF BUSINESS: ${data.organization.industry}\n\nWEBSITE: ${data.organization.website_url}\n\nSOCIAL MEDIA ACCOUNT: \n\nHOW MANY VA'S NEEDED: 1\n\nWORKING HOURS: \n\nTARGET START DATE: ${data.expected_start_date}\n\nSPECIFIC REQUEST: N/A\n\n﻿﻿NAME: ${data.organization.name}EMAIL: PHONE NO ${data.organization.phone} \n\nDESCRIPTION: ${data.description}\n\nNO. OF VAs: 1\n\nFULL TIME OR PART-TIME: ${data.availability}}\n\nSKILLS: ${data.skills.join(", ")}`;
            const response = await axios.post(
              "https://api.hubapi.com/crm/v3/objects/tickets",
              {
                properties: {
                  subject: data.title,
                  content,
                  hs_pipeline: "0", //=>Pairing Pipeline
                  hs_pipeline_stage: "1",  //=> New agent Request
                  ticket_type: "Agent Pairing Request",
                  priority: data.priority,
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
        
            console.log(" Ticket created successfull");
            console.log(response.data);
          } catch (error) {
            if (error.response) {
              console.error("Error to created ticket:", error.response.data);
            } else {
              console.error("Connection error:", error.message);
            }
          }
        
    }
}