import { Injectable } from "@nestjs/common";
import axios from "axios";
import { HubspotAuditAction, HubspotAuditSource, HubspotEntityType } from "@prisma/client";
import { HubspotAuditService } from "../hubspot-audit.service";

@Injectable()

export class ContactDeleteService {
    constructor(private readonly audit: HubspotAuditService) {}

    async execute(data: any, actorUserId?: string): Promise<any> {
      const source = actorUserId ? HubspotAuditSource.user_action : HubspotAuditSource.cron;
      try {
          const response = await axios.delete(
          `https://api.hubapi.com/crm/v3/objects/contacts/${Number(data.hubspot_contact_id)}`,
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
          action: HubspotAuditAction.DELETE,
          source,
          success: true,
        });

        return true;
      } catch (error) {
        if (error.response) {
          console.error("Error to delete contact:", error.response.data);
        } else {
          console.error("Connection error:", error.message);
        }
        void this.audit.log({
          actorUserId,
          entityType: HubspotEntityType.contact,
          entityId: data.id ?? data.hubspot_contact_id,
          hubspotObjectId: data.hubspot_contact_id,
          hubspotObjectType: 'contacts',
          action: HubspotAuditAction.DELETE,
          source,
          success: false,
          errorCode: error.response?.status?.toString() ?? error.code,
          errorMessage: error.message,
        });
      }

    }
}
