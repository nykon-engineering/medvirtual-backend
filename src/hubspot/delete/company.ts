import { Injectable } from '@nestjs/common';
import axios from 'axios';
import {
  HubspotAuditAction,
  HubspotAuditSource,
  HubspotEntityType,
} from '@prisma/client';
import { HubspotAuditService } from '../hubspot-audit.service';

@Injectable()
export class CompanyDeleteService {
  constructor(private readonly audit: HubspotAuditService) {}

  async execute(
    hubspotCompanyId: string,
    actorUserId?: string,
    entityId?: string,
    reason?: string,
  ): Promise<boolean> {
    const source = actorUserId
      ? HubspotAuditSource.user_action
      : HubspotAuditSource.cron;
    try {
      const response = await axios.delete(
        `https://api.hubapi.com/crm/v3/objects/companies/${hubspotCompanyId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      );

      void this.audit.log({
        actorUserId,
        entityType: HubspotEntityType.organization,
        entityId: entityId ?? hubspotCompanyId,
        hubspotObjectId: hubspotCompanyId,
        hubspotObjectType: 'companies',
        action: HubspotAuditAction.DELETE,
        source,
        success: true,
        payload: { ...(reason && { reason }) },
      });

      return true;
    } catch (error) {
      if (error.response) {
        console.error('Error to delete company:', error.response.data);
      } else {
        console.error('Connection error:', error.message);
      }
      void this.audit.log({
        actorUserId,
        entityType: HubspotEntityType.organization,
        entityId: entityId ?? hubspotCompanyId,
        hubspotObjectId: hubspotCompanyId,
        hubspotObjectType: 'companies',
        action: HubspotAuditAction.DELETE,
        source,
        success: false,
        errorCode: error.response?.status?.toString() ?? error.code,
        errorMessage: error.message,
        payload: { ...(reason && { reason }) },
      });
      return false;
    }
  }
}
