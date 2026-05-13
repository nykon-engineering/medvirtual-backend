import { Injectable } from '@nestjs/common';
import axios from 'axios';
import {
  HubspotAuditAction,
  HubspotAuditSource,
  HubspotEntityType,
} from '@prisma/client';
import { HubspotAuditService } from '../hubspot-audit.service';

const OBJECT_TYPE = 'p20630393_growth_partners';

@Injectable()
export class AffiliateUpdateService {
  constructor(private readonly audit: HubspotAuditService) {}

  async deactivate(
    hubspotId: string,
    actorUserId?: string,
    entityId?: string,
  ): Promise<void> {
    const source = actorUserId
      ? HubspotAuditSource.user_action
      : HubspotAuditSource.cron;
    try {
      await axios.patch(
        `https://api.hubapi.com/crm/v3/objects/${OBJECT_TYPE}/${Number(hubspotId)}`,
        { properties: { hs_pipeline_stage: '1329693872' } },
        {
          headers: {
            Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      );
      void this.audit.log({
        actorUserId,
        entityType: HubspotEntityType.affiliate,
        entityId: entityId ?? hubspotId,
        hubspotObjectId: hubspotId,
        hubspotObjectType: OBJECT_TYPE,
        action: HubspotAuditAction.UPDATE,
        source,
        success: true,
        payload: { hs_pipeline_stage: '1329693872' },
      });
    } catch (error) {
      if (error.response) {
        console.error(
          'Error updating Growth Partner in HubSpot:',
          error.response.data,
        );
      } else {
        console.error('Connection error:', error.message);
      }
      void this.audit.log({
        actorUserId,
        entityType: HubspotEntityType.affiliate,
        entityId: entityId ?? hubspotId,
        hubspotObjectId: hubspotId,
        hubspotObjectType: OBJECT_TYPE,
        action: HubspotAuditAction.UPDATE,
        source,
        success: false,
        errorCode: error.response?.status?.toString() ?? error.code,
        errorMessage: error.message,
      });
    }
  }

  async reactivate(
    hubspotId: string,
    actorUserId?: string,
    entityId?: string,
  ): Promise<void> {
    const source = actorUserId
      ? HubspotAuditSource.user_action
      : HubspotAuditSource.cron;
    try {
      await axios.patch(
        `https://api.hubapi.com/crm/v3/objects/${OBJECT_TYPE}/${Number(hubspotId)}`,
        { properties: { hs_pipeline_stage: '1329693870' } },
        {
          headers: {
            Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      );
      void this.audit.log({
        actorUserId,
        entityType: HubspotEntityType.affiliate,
        entityId: entityId ?? hubspotId,
        hubspotObjectId: hubspotId,
        hubspotObjectType: OBJECT_TYPE,
        action: HubspotAuditAction.UPDATE,
        source,
        success: true,
        payload: { hs_pipeline_stage: '1329693870' },
      });
    } catch (error) {
      if (error.response) {
        console.error(
          'Error updating Growth Partner in HubSpot:',
          error.response.data,
        );
      } else {
        console.error('Connection error:', error.message);
      }
      void this.audit.log({
        actorUserId,
        entityType: HubspotEntityType.affiliate,
        entityId: entityId ?? hubspotId,
        hubspotObjectId: hubspotId,
        hubspotObjectType: OBJECT_TYPE,
        action: HubspotAuditAction.UPDATE,
        source,
        success: false,
        errorCode: error.response?.status?.toString() ?? error.code,
        errorMessage: error.message,
      });
    }
  }

  async updateCommission(
    hubspotId: string,
    commissionPercent: number,
    actorUserId?: string,
    entityId?: string,
  ): Promise<void> {
    const source = actorUserId
      ? HubspotAuditSource.user_action
      : HubspotAuditSource.cron;
    try {
      await axios.patch(
        `https://api.hubapi.com/crm/v3/objects/${OBJECT_TYPE}/${Number(hubspotId)}`,
        { properties: { alliance_commission: String(commissionPercent) } },
        {
          headers: {
            Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      );
      void this.audit.log({
        actorUserId,
        entityType: HubspotEntityType.affiliate,
        entityId: entityId ?? hubspotId,
        hubspotObjectId: hubspotId,
        hubspotObjectType: OBJECT_TYPE,
        action: HubspotAuditAction.UPDATE,
        source,
        success: true,
        payload: { alliance_commission: commissionPercent },
      });
    } catch (error) {
      if (error.response) {
        console.error(
          'Error updating Growth Partner commission in HubSpot:',
          error.response.data,
        );
      } else {
        console.error('Connection error:', error.message);
      }
      void this.audit.log({
        actorUserId,
        entityType: HubspotEntityType.affiliate,
        entityId: entityId ?? hubspotId,
        hubspotObjectId: hubspotId,
        hubspotObjectType: OBJECT_TYPE,
        action: HubspotAuditAction.UPDATE,
        source,
        success: false,
        errorCode: error.response?.status?.toString() ?? error.code,
        errorMessage: error.message,
      });
    }
  }

  async updateBankingData(
    hubspotId: string,
    accountName: string,
    accountNumber: string,
    actorUserId?: string,
    entityId?: string,
  ): Promise<void> {
    const source = actorUserId
      ? HubspotAuditSource.user_action
      : HubspotAuditSource.cron;
    try {
      await axios.patch(
        `https://api.hubapi.com/crm/v3/objects/${OBJECT_TYPE}/${Number(hubspotId)}`,
        {
          properties: {
            account_name: accountName,
            account_number: accountNumber,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      );
      void this.audit.log({
        actorUserId,
        entityType: HubspotEntityType.affiliate,
        entityId: entityId ?? hubspotId,
        hubspotObjectId: hubspotId,
        hubspotObjectType: OBJECT_TYPE,
        action: HubspotAuditAction.UPDATE,
        source,
        success: true,
        payload: { fields: ['account_name', 'account_number'] },
      });
    } catch (error) {
      if (error.response) {
        console.error(
          'Error updating Growth Partner banking data in HubSpot:',
          error.response.data,
        );
      } else {
        console.error('Connection error:', error.message);
      }
      void this.audit.log({
        actorUserId,
        entityType: HubspotEntityType.affiliate,
        entityId: entityId ?? hubspotId,
        hubspotObjectId: hubspotId,
        hubspotObjectType: OBJECT_TYPE,
        action: HubspotAuditAction.UPDATE,
        source,
        success: false,
        errorCode: error.response?.status?.toString() ?? error.code,
        errorMessage: error.message,
      });
    }
  }

  async clearBankingData(
    hubspotId: string,
    actorUserId?: string,
    entityId?: string,
  ): Promise<void> {
    const source = actorUserId
      ? HubspotAuditSource.user_action
      : HubspotAuditSource.cron;
    try {
      await axios.patch(
        `https://api.hubapi.com/crm/v3/objects/${OBJECT_TYPE}/${Number(hubspotId)}`,
        { properties: { account_name: '', account_number: '' } },
        {
          headers: {
            Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      );
      void this.audit.log({
        actorUserId,
        entityType: HubspotEntityType.affiliate,
        entityId: entityId ?? hubspotId,
        hubspotObjectId: hubspotId,
        hubspotObjectType: OBJECT_TYPE,
        action: HubspotAuditAction.UPDATE,
        source,
        success: true,
        payload: { fields: ['account_name', 'account_number'], cleared: true },
      });
    } catch (error) {
      if (error.response) {
        console.error(
          'Error clearing Growth Partner banking data in HubSpot:',
          error.response.data,
        );
      } else {
        console.error('Connection error:', error.message);
      }
      void this.audit.log({
        actorUserId,
        entityType: HubspotEntityType.affiliate,
        entityId: entityId ?? hubspotId,
        hubspotObjectId: hubspotId,
        hubspotObjectType: OBJECT_TYPE,
        action: HubspotAuditAction.UPDATE,
        source,
        success: false,
        errorCode: error.response?.status?.toString() ?? error.code,
        errorMessage: error.message,
      });
    }
  }
}
