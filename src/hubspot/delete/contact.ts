import { Injectable } from "@nestjs/common";
import axios from "axios";

@Injectable()

export class ContactDeleteService {
    constructor(){}

    async execute(data: any): Promise<any> {
      try {

          //console.log(hubspotProperties)
          const response = await axios.delete(
          `https://api.hubapi.com/crm/v3/objects/contacts/${Number(data.hubspot_contact_id)}`,
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
          console.error("Error to delete contact:", error.response.data);
        } else {
          console.error("Connection error:", error.message);
        }
      }
        
    }
}