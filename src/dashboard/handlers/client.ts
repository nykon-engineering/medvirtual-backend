/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HandlerClient {
  constructor(private readonly prisma: PrismaService) {}

  async execute(user: any): Promise<object> {
    const result: any = {};

    if (!user || !user.organization_id) {
      throw new Error('User or organization not found');
    }

    const newRequestsCount = await this.prisma.hireRequest.count({
      where: {
        org_id: user.organization_id,
        status: 'new',
      },
    });
    result.newRequests = newRequestsCount;

    const panelToScheduleCount = await this.prisma.hireRequest.count({
      where: {
        org_id: user.organization_id,
        status: 'panel_ready',
      },
    });
    result.panelsToSchedule = panelToScheduleCount;

    const pendingDecisionsCount = await this.prisma.hireRequest.count({
      where: {
        org_id: user.organization_id,
        status: 'awaiting_decision',
      },
    });
    result.pendingDecisions = pendingDecisionsCount;

    const openTicketsCount = await this.prisma.ticket.count({
      where: {
        user: {
          organization_id: user.organization_id,
        },
        status: 'new',
      },
    });
    result.openTickets = openTicketsCount;

    const hireRequest = await this.prisma.hireRequest.findMany({
      where: {
        org_id: user.organization_id,
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        createdAt: true,
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        panels: {
          select: {
            id: true,
            status: true,
            scheduled_date: true,
            createdAt: true,
            panelCandidates: {
              select: {
                id: true,
                candidate: {
                  select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                    email: true,
                    hourly_pay_rate: true,
                    organization_id: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    result.hireRequests = hireRequest;

    return result;
  }
}
