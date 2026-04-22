import { Injectable } from "@nestjs/common";
import axios from "axios";

@Injectable()
export class CompanyDeleteService {
    constructor(){}

    async execute(hubspotCompanyId: string): Promise<boolean> {
      try {
          const response = await axios.delete(
          `https://api.hubapi.com/crm/v3/objects/companies/${hubspotCompanyId}`,
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
          console.error("Error to delete company:", error.response.data);
        } else {
          console.error("Connection error:", error.message);
        }
        return false;
      }
    }
}
