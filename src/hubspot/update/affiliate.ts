import { Injectable } from "@nestjs/common";
import axios from "axios";

@Injectable()
export class AffiliateUpdateService {
    async deactivate(hubspotId: string): Promise<void> {
        try {
            await axios.patch(
                `https://api.hubapi.com/crm/v3/objects/p20630393_growth_partners/${Number(hubspotId)}`,
                {
                    properties: {
                        hs_pipeline_stage: '1329693872',
                    },
                },
                {
                    headers: {
                        Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                        "Content-Type": "application/json",
                    },
                }
            );
        } catch (error) {
            if (error.response) {
                console.error("Error updating Growth Partner in HubSpot:", error.response.data);
            } else {
                console.error("Connection error:", error.message);
            }
        }
    }

    async reactivate(hubspotId: string): Promise<void> {
        try {
            await axios.patch(
                `https://api.hubapi.com/crm/v3/objects/p20630393_growth_partners/${Number(hubspotId)}`,
                {
                    properties: {
                        hs_pipeline_stage: '1329693870',
                    },
                },
                {
                    headers: {
                        Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                        "Content-Type": "application/json",
                    },
                }
            );
        } catch (error) {
            if (error.response) {
                console.error("Error updating Growth Partner in HubSpot:", error.response.data);
            } else {
                console.error("Connection error:", error.message);
            }
        }
    }
}
