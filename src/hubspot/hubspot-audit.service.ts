import { Injectable } from '@nestjs/common';
import {
  HubspotAuditAction,
  HubspotAuditSource,
  HubspotEntityType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface HubspotAuditLogParams {
  actorUserId?: string | null;
  actorLabel?: string | null;
  entityType: HubspotEntityType;
  entityId: string;
  hubspotObjectId?: string | null;
  hubspotObjectType: string;
  action: HubspotAuditAction;
  source: HubspotAuditSource;
  success: boolean;
  payload?: Record<string, any> | null;
  response?: Record<string, any> | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

@Injectable()
export class HubspotAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: HubspotAuditLogParams): Promise<void> {
    try {
      await this.prisma.hubspotAuditLog.create({
        data: {
          actor_user_id: params.actorUserId ?? null,
          actor_label: params.actorLabel ?? null,
          entity_type: params.entityType,
          entity_id: params.entityId,
          hubspot_object_id: params.hubspotObjectId ?? null,
          hubspot_object_type: params.hubspotObjectType,
          action: params.action,
          source: params.source,
          success: params.success,
          payload: params.payload ?? undefined,
          response: params.response ?? undefined,
          error_code: params.errorCode ?? null,
          error_message: params.errorMessage ?? null,
        },
      });
    } catch (err) {
      console.error('[HubspotAudit] Failed to write audit log:', err);
    }
  }
}
