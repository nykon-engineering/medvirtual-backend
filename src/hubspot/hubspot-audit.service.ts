import { Injectable } from '@nestjs/common';
import {
  HubspotAuditAction,
  HubspotAuditSource,
  HubspotEntityType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListHubspotAuditLogsDto } from './dto/list-hubspot-audit-logs.dto';

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

  async findAllLogs(dto: ListHubspotAuditLogsDto) {
    const {
      page = 1,
      limit = 20,
      entity_type,
      action,
      source,
      success,
      date_from,
      date_to,
      search,
      sortOrder = 'desc',
    } = dto;

    const where: Prisma.HubspotAuditLogWhereInput = {
      ...(entity_type && { entity_type }),
      ...(action && { action }),
      ...(source && { source }),
      ...(success !== undefined && { success }),
      ...(date_from || date_to
        ? {
            createdAt: {
              ...(date_from && { gte: new Date(date_from) }),
              ...(date_to && {
                lte: new Date(new Date(date_to).setHours(23, 59, 59, 999)),
              }),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { entity_id: { contains: search, mode: 'insensitive' } },
              { actor_label: { contains: search, mode: 'insensitive' } },
              { hubspot_object_id: { contains: search, mode: 'insensitive' } },
              { error_message: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      this.prisma.hubspotAuditLog.count({ where }),
      this.prisma.hubspotAuditLog.findMany({
        where,
        orderBy: { createdAt: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          actor_label: true,
          entity_type: true,
          entity_id: true,
          hubspot_object_id: true,
          hubspot_object_type: true,
          action: true,
          source: true,
          success: true,
          payload: true,
          response: true,
          error_code: true,
          error_message: true,
          createdAt: true,
          actorUser: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
        },
      }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
