import { Injectable } from "@nestjs/common";
import axios from "axios";
import { dbToContactDictionary } from "../../common/dictionaries/contact-dictionary";

@Injectable()

export class ContactUpdateService {
    constructor(){}

    async execute(data: any): Promise<any> {
      try {
          const hubspotProperties: Record<string, any> = {};
          for (const [dbKey, hubspotKey] of Object.entries(dbToContactDictionary)) {
            if (data[dbKey] !== undefined && data[dbKey] !== null) {
              hubspotProperties[hubspotKey] = data[dbKey];
            }
          }

          //console.log(hubspotProperties)
          const response = await axios.patch(
          `https://api.hubapi.com/crm/v3/objects/contacts/${Number(data.hubspot_contact_id)}`,
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
          console.error("Error to update contact:", error.response.data);
        } else {
          console.error("Connection error:", error.message);
        }
      }
        
    }
}