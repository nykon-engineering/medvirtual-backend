import { Injectable } from "@nestjs/common";
import axios from "axios";
import { HubspotAuditAction, HubspotAuditSource, HubspotEntityType } from "@prisma/client";
import { dbToContactDictionary } from "../../common/dictionaries/contact-dictionary";
import { HubspotAuditService } from "../hubspot-audit.service";

@Injectable()

export class ContactUpdateService {
    constructor(private readonly audit: HubspotAuditService) {}

    async execute(data: any, actorUserId?: string): Promise<any> {
      const source = actorUserId ? HubspotAuditSource.user_action : HubspotAuditSource.cron;
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

        void this.audit.log({
          actorUserId,
          entityType: HubspotEntityType.contact,
          entityId: data.id ?? data.hubspot_contact_id,
          hubspotObjectId: data.hubspot_contact_id,
          hubspotObjectType: 'contacts',
          action: HubspotAuditAction.UPDATE,
          source,
          success: true,
          payload: { fields: Object.keys(hubspotProperties) },
        });

        return true;
      } catch (error) {
        if (error.response) {
          console.error("Error to update contact:", error.response.data);
        } else {
          console.error("Connection error:", error.message);
        }
        void this.audit.log({
          actorUserId,
          entityType: HubspotEntityType.contact,
          entityId: data.id ?? data.hubspot_contact_id,
          hubspotObjectId: data.hubspot_contact_id,
          hubspotObjectType: 'contacts',
          action: HubspotAuditAction.UPDATE,
          source,
          success: false,
          errorCode: error.response?.status?.toString() ?? error.code,
          errorMessage: error.message,
        });
      }

    }
}
