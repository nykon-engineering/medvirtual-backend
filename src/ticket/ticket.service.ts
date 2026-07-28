import {
  BadRequestException,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

import { CreateTicketDto } from './dto/create-ticket.dto';
import { Priority, TicketStatus, USER } from '@prisma/client';
import { ticketTypeDictionary } from '../common/dictionaries/ticket-type';
import { reassignTicketDto } from './dto/reassign-ticket.dto';
import { ListTicketAuditLogsDto } from './dto/list-ticket-audit-logs.dto';
import {
  TicketAuditService,
  TICKET_AUDIT_EVENTS,
  TICKET_AUDIT_ORIGINS,
  buildActorLabel,
} from './ticket-audit.service';

/** Which side of the soft-delete boundary a ticket listing should read from. */
export type TicketDeletedStatus = 'active' | 'deleted';

@Injectable()
export class TicketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: TicketAuditService,
  ) {}

  private isSystemAdmin(user: USER) {
    return user?.role === 'system_admin' || user?.role === 'system_super_admin';
  }

  /**
   * Ticket titles are system-generated for bonus/termination/interview types but authored by
   * the user for support tickets, where they may contain PII. Only the former are safe to
   * persist into the audit log.
   */
  private auditSafeTitle(ticket: {
    type?: string | null;
    title?: string | null;
  }): Record<string, any> {
    return ticket.type === 'support'
      ? { titleLength: ticket.title?.length ?? 0 }
      : { title: ticket.title ?? null };
  }

  async findOne(id: string, user?: USER, includeDeleted = false): Promise<any> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, ...(includeDeleted ? {} : { deleted_at: null }) },
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        createdAt: true,
        created_by: true,
        organization: {
          select: {
            id: true,
            name: true,
            email: true,
            business_unit: true,
            organization_role: true,
            status: true,
            admin: {
              select: { id: true, first_name: true, last_name: true },
            },
          },
        },
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            job_title: true,
            role: true,
            status: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            job_title: true,
            role: true,
            status: true,
          },
        },
        candidate: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            name: true,
            specialization: true,
            years_of_experience: true,
            country: true,
            gender: true,
            avatar_url: true,
          },
        },
        staff: {
          select: {
            id: true,
            status: true,
            salary: true,
            start_date: true,
            candidate: {
              select: {
                id: true,
                email: true,
                name: true,
                specialization: true,
                years_of_experience: true,
                country: true,
              },
            },
          },
        },
        offerPanel: {
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            business_unit: true,
            recipient_name: true,
            recipient_email: true,
            recipient_org_name: true,
            recipient_type: true,
            recipient_company_id: true,
            recipientCompany: {
              select: {
                id: true,
                name: true,
                business_unit: true,
                organization_role: true,
                status: true,
                admin: {
                  select: { id: true, first_name: true, last_name: true },
                },
              },
            },
            view_count: true,
            viewed_at: true,
            decided_at: true,
            public_token: true,
            is_public: true,
            createdAt: true,
          },
        },
      },
    });

    if (!ticket) {
      throw new BadRequestException('Ticket not found');
    }

    // Access control: Organization admins can only see tickets they created
    if (user) {
      const isOrganizationAdmin =
        user.role === 'organization_admin' ||
        user.role === 'organization_super_admin';
      if (isOrganizationAdmin) {
        // For organization_super_admin, allow tickets from their organization
        // For organization_admin, only allow tickets they created
        if (
          user.role === 'organization_admin' &&
          ticket.created_by !== user.id
        ) {
          throw new ForbiddenException('You can only view tickets you created');
        }
        if (user.role === 'organization_super_admin') {
          // Allow if ticket belongs to their organization OR if they created it
          if (
            ticket.organization?.id !== user.organization_id &&
            ticket.created_by !== user.id
          ) {
            throw new ForbiddenException(
              'You can only view tickets from your organization or tickets you created',
            );
          }
        }
      }
    }

    return ticket;
  }

  async create(createTicketDto: CreateTicketDto, user: USER): Promise<object> {
    const typeBE = ticketTypeDictionary[createTicketDto.type] ?? null;

    if (
      createTicketDto.type === 'Interview Request' &&
      !createTicketDto.candidate_id
    ) {
      throw new BadRequestException(
        'Candidate ID is required for Interview Request tickets',
      );
    }

    if (
      (createTicketDto.type === 'Bonus' ||
        createTicketDto.type === 'Termination') &&
      !createTicketDto.staff_id
    ) {
      throw new BadRequestException(
        'Staff ID is required for Bonus and Termination tickets',
      );
    }

    if (
      createTicketDto.type === 'hire_request_cancellation' &&
      !createTicketDto.hireRequest_id
    ) {
      throw new BadRequestException(
        'Hire Request ID is required for hire request cancellation tickets',
      );
    }

    if (createTicketDto.candidate_id) {
      const candidate = await this.prisma.candidate.findUnique({
        where: { id: createTicketDto.candidate_id },
      });
      if (!candidate) {
        throw new BadRequestException('Candidate not found');
      }
    }

    if (createTicketDto.staff_id) {
      const staff = await this.prisma.staff.findUnique({
        where: { id: createTicketDto.staff_id },
        include: {
          hireRequest: {
            select: {
              org_id: true,
            },
          },
        },
      });
      if (!staff) {
        throw new BadRequestException(
          `Staff member with ID ${createTicketDto.staff_id} not found`,
        );
      }

      // Verify staff belongs to the organization making the request
      if (
        user.role.includes('organization') &&
        staff?.hireRequest?.org_id !== user.organization_id
      ) {
        throw new BadRequestException(
          'Staff member does not belong to your organization',
        );
      }
    }

    if (createTicketDto.hireRequest_id) {
      const hireRequest = await this.prisma.hireRequest.findUnique({
        where: { id: createTicketDto.hireRequest_id },
      });
      if (!hireRequest) {
        throw new BadRequestException('Candidate not found');
      }
    }

    let assignedValidatedUser;
    let assignedValidatedOrg;

    // For support and hire request cancellation tickets, organization is optional
    if (
      createTicketDto.type === 'Support' ||
      createTicketDto.type === 'hire_request_cancellation'
    ) {
      assignedValidatedUser = Array.isArray(createTicketDto.assigned_user_id)
        ? createTicketDto.assigned_user_id[0]
        : createTicketDto.assigned_user_id;
      assignedValidatedOrg = createTicketDto.client_id;
    } else {
      // For other ticket types, organization is required
      if (
        !user ||
        (user.role.includes('organization') && !user.organization_id)
      )
        throw new BadRequestException('User organization not found');
      if (user.role.includes('organization')) {
        //get the concierge client as assigned user
        const org = await this.prisma.organization.findUnique({
          where: { id: user.organization_id || undefined },
          select: {
            admin_id: true,
            id: true,
          },
        });
        if (!org) throw new BadRequestException('Organization not found');
        assignedValidatedUser = org.admin_id;
        assignedValidatedOrg = org.id;
      } else {
        assignedValidatedUser = Array.isArray(createTicketDto.assigned_user_id)
          ? createTicketDto.assigned_user_id[0]
          : createTicketDto.assigned_user_id;
        assignedValidatedOrg = createTicketDto.client_id;
      }
    }

    // Validate that the user creating the ticket exists
    const creatorUser = await this.prisma.uSER.findUnique({
      where: { id: user.id },
    });
    if (!creatorUser) {
      throw new BadRequestException(
        `User with ID ${user.id} not found. Cannot create ticket.`,
      );
    }

    // Validate that the assigned user exists (if provided)
    if (assignedValidatedUser) {
      const assignedUser = await this.prisma.uSER.findUnique({
        where: { id: assignedValidatedUser },
      });
      if (!assignedUser) {
        throw new BadRequestException(
          `Assigned user with ID ${assignedValidatedUser} not found.`,
        );
      }
    }

    try {
      const data: any = {
        type: typeBE,
        title: createTicketDto.title,
        description: createTicketDto.description,
        priority: createTicketDto.priority,
        createdBy: { connect: { id: user.id } },
      };

      if (assignedValidatedOrg) {
        data.organization = { connect: { id: assignedValidatedOrg } };
      }

      if (assignedValidatedUser) {
        data.user = { connect: { id: assignedValidatedUser } };
      }

      if (createTicketDto.candidate_id) {
        data.candidate = { connect: { id: createTicketDto.candidate_id } };
      }

      if (createTicketDto.staff_id) {
        data.staff = { connect: { id: createTicketDto.staff_id } };
      }

      if (createTicketDto.hireRequest_id) {
        data.hireRequest = { connect: { id: createTicketDto.hireRequest_id } };
      }

      const ticket = await this.prisma.ticket.create({
        data,
      });
      if (!ticket) throw new BadRequestException('Failed to create ticket');

      const ticketFull = await this.findOne(ticket.id);
      if (!ticketFull)
        throw new BadRequestException('Failed to retrieve full ticket');

      void this.audit.log({
        ticketId: ticket.id,
        actorUserId: user?.id ?? null,
        actorLabel: buildActorLabel(user),
        event: TICKET_AUDIT_EVENTS.CREATED,
        newStatus: ticket.status,
        after: {
          status: ticket.status,
          type: ticket.type,
          priority: ticket.priority,
          org_id: ticket.org_id,
          user_id: ticket.user_id,
          staff_id: ticket.staff_id,
          candidate_id: ticket.candidate_id,
          hireRequest_id: ticket.hireRequest_id,
          offer_panel_id: ticket.offer_panel_id,
          ...this.auditSafeTitle(ticket),
        },
        metadata: {
          origin: TICKET_AUDIT_ORIGINS.TICKET_ENDPOINT,
          actorRole: user?.role ?? null,
          actorOrganizationId: user?.organization_id ?? null,
          requestedType: createTicketDto.type,
          assignedAtCreation: ticket.user_id ?? null,
        },
      });

      // Notify assignee via email (non-blocking)
      try {
        await this.notifications.notifyTicketEvent(ticketFull, 'created');
      } catch (err) {
        console.warn(
          '[notifications] ticket-created email failed',
          err?.message || err,
        );
      }

      return ticketFull;
    } catch (error) {
      throw new BadRequestException('Error creating ticket', error.message);
    }
  }

  async findAll(
    user: USER,
    type?: string,
    priority?: string,
    assigned_user_id?: string,
    search?: string,
    deletedStatus?: TicketDeletedStatus,
  ): Promise<object> {
    try {
      // Calculate date 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Only super admins may look at tombstones. Enforced here rather than in the
      // controller so internal callers cannot bypass it by passing the flag directly.
      const canSeeDeleted = user.role === 'system_super_admin';
      const effectiveDeletedStatus: TicketDeletedStatus = canSeeDeleted
        ? (deletedStatus ?? 'active')
        : 'active';

      const tickets = await this.prisma.ticket.findMany({
        where: {
          type: type ? type : undefined,
          priority: priority ? (priority as Priority) : undefined,
          ...(effectiveDeletedStatus === 'deleted'
            ? { deleted_at: { not: null } }
            : { deleted_at: null }),
          ...(user.role === 'system_super_admin'
            ? {}
            : user.role === 'system_admin'
              ? {
                  OR: [
                    { user: { is: { id: user.id } } },
                    { created_by: user.id },
                  ],
                }
              : user.role === 'organization_super_admin'
                ? {
                    organization: user.organization_id
                      ? { id: user.organization_id }
                      : undefined,
                  }
                : user.role === 'organization_admin'
                  ? {
                      created_by: user.id,
                    }
                  : user.role === 'affiliate'
                    ? {
                        created_by: user.id,
                      }
                    : { user: { is: { id: user.id } } }),
          ...(search
            ? {
                OR: [
                  {
                    organization: {
                      name: { contains: search, mode: 'insensitive' },
                    },
                  },
                  { title: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {}),

          // Exclude tickets that are closed and were last updated more than 30 days ago
          NOT: {
            AND: [{ status: 'closed' }, { updatedAt: { lt: thirtyDaysAgo } }],
          },
        },
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          createdAt: true,
          created_by: true,
          deleted_at: true,
          deleted_by: true,
          deletion_reason: true,
          organization: {
            select: {
              id: true,
              name: true,
              email: true,
              business_unit: true,
              status: true,
              admin_id: true,
            },
          },
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              job_title: true,
              role: true,
              status: true,
              email: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              job_title: true,
              role: true,
              status: true,
            },
          },
          candidate: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              name: true,
              gender: true,
              avatar_url: true,
            },
          },
          staff: {
            select: {
              id: true,
              status: true,
              start_date: true,
              terminated_date: true,
              candidate: {
                select: {
                  id: true,
                  first_name: true,
                  last_name: true,
                  email: true,
                  name: true,
                  specialization: true,
                  years_of_experience: true,
                  gender: true,
                  avatar_url: true,
                },
              },
            },
          },
          offerPanel: {
            select: {
              id: true,
              title: true,
              description: true,
              status: true,
              business_unit: true,
              recipient_name: true,
              recipient_email: true,
              recipient_org_name: true,
              recipient_type: true,
              view_count: true,
              viewed_at: true,
              decided_at: true,
              public_token: true,
              is_public: true,
              createdAt: true,
            },
          },
        },
      });
      if (!tickets) throw new BadRequestException('Failed to fetch tickets');

      const filteredTickets = tickets.map((ticket: any) => ({
        ...ticket,
        candidate: ticket.candidate
          ? {
              ...ticket.candidate,
              avatar: ticket.candidate.avatar_url
                ? `${process.env.AVATAR_URL}${ticket.candidate.avatar_url}`
                : null,
            }
          : null,
        staff: ticket.staff
          ? {
              ...ticket.staff,
              candidate: ticket.staff.candidate
                ? {
                    ...ticket.staff.candidate,
                    avatar: ticket.staff.candidate.avatar_url
                      ? `${process.env.AVATAR_URL}${ticket.staff.candidate.avatar_url}`
                      : null,
                  }
                : null,
            }
          : null,
      }));

      return filteredTickets;
    } catch (error) {
      throw new BadRequestException('Error fetching tickets');
    }
  }

  async reassing(
    id: string,
    data: reassignTicketDto,
    user?: USER,
  ): Promise<object> {
    try {
      const currentTicket = await this.prisma.ticket.findFirst({
        where: { id, deleted_at: null },
        select: {
          status: true,
          user_id: true,
        },
      });
      if (!currentTicket) throw new BadRequestException('Ticket not found');
      if (currentTicket.status !== 'new' && !data.assigned_user_id)
        throw new BadRequestException(
          'Reassigning to unassigned is only allowed for NEW tickets',
        );

      const ticketUpdated = await this.prisma.ticket.update({
        where: { id },
        data: {
          user: data.assigned_user_id
            ? { connect: { id: data.assigned_user_id } }
            : { disconnect: true },
        },
      });

      if (!ticketUpdated)
        throw new BadRequestException('Failed to reassign ticket');

      const ticket = await this.findOne(id);
      if (!ticket)
        throw new BadRequestException('Failed to fetch reassigned ticket');

      void this.audit.log({
        ticketId: id,
        actorUserId: user?.id ?? null,
        actorLabel: buildActorLabel(user),
        event: TICKET_AUDIT_EVENTS.REASSIGNED,
        before: { user_id: currentTicket.user_id },
        after: { user_id: data.assigned_user_id ?? null },
        metadata: {
          actorRole: user?.role ?? null,
          unassigned: !data.assigned_user_id,
          previousAssignee: currentTicket.user_id,
        },
      });

      // Notify assignee via email (non-blocking)
      try {
        await this.notifications.notifyTicketEvent(ticket, 'assigned');
      } catch (err) {
        console.warn(
          '[notifications] ticket-assigned email failed',
          err?.message || err,
        );
      }

      return ticket;
    } catch (error) {
      throw new BadRequestException('Error reassigning ticket', error.message);
    }
  }

  async updateStatus(
    id: string,
    data: { status: string },
    user?: USER,
  ): Promise<object> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, deleted_at: null },
      select: {
        status: true,
        type: true,
        staff: {
          select: {
            id: true,
          },
        },
        user: {
          select: {
            id: true,
          },
        },
      },
    });
    if (!ticket) throw new BadRequestException('Ticket not found');
    if (ticket.status === data.status)
      throw new BadRequestException(
        `Ticket is already in status: ${data.status}`,
      );

    // Store old status before update for notification logic
    const oldStatus = ticket.status;

    if (ticket.status === 'closed' && data.status === 'resolved')
      throw new BadRequestException(
        'Cannot change status from CLOSED to RESOLVED',
      );
    if (
      (ticket.status === 'new' &&
        data.status === 'in_progress' &&
        !ticket.user?.id) ||
      (ticket.status === 'new' &&
        data.status === 'resolved' &&
        !ticket.user?.id)
    )
      throw new BadRequestException(
        `Please assign a user to the ticket before changing status to ${data.status.replace('_', ' ').toUpperCase()}`,
      );
    const staffTerminatedByThisChange =
      data.status === 'resolved' &&
      ticket.type === 'termination' &&
      !!ticket.staff?.id;

    if (staffTerminatedByThisChange) {
      //terminate the staff => update staff status to terminated and terminated staff
      await this.prisma.staff.update({
        where: {
          id: ticket.staff!.id,
        },
        data: {
          status: 'terminated',
          terminated_date: new Date(),
        },
      });
    }
    try {
      const ticketUpdated = await this.prisma.ticket.update({
        where: { id },
        data: {
          status: data.status as TicketStatus,
        },
      });
      if (!ticketUpdated)
        throw new BadRequestException('Failed to update ticket status');

      const ticket = await this.findOne(id);
      if (!ticket)
        throw new BadRequestException('Failed to fetch reassigned ticket');

      void this.audit.log({
        ticketId: id,
        actorUserId: user?.id ?? null,
        actorLabel: buildActorLabel(user),
        event: TICKET_AUDIT_EVENTS.STATUS_CHANGED,
        oldStatus,
        newStatus: data.status,
        before: { status: oldStatus },
        after: { status: data.status },
        metadata: {
          actorRole: user?.role ?? null,
          ticketType: ticket.type,
          // updateStatus terminates the staff member when a termination ticket resolves.
          staffTerminated: staffTerminatedByThisChange,
        },
      });

      // Notify creator on status change to in_progress, resolved, or closed (non-blocking)
      try {
        if (
          data.status === 'in_progress' ||
          data.status === 'resolved' ||
          data.status === 'closed'
        ) {
          await this.notifications.notifyTicketStatusChangeToCreator(
            ticket,
            data.status,
          );
        } else if (oldStatus === 'closed' && data.status === 'new') {
          // Notify when ticket is reopened from closed to new
          await this.notifications.notifyTicketReopened(ticket);
        }
      } catch (err) {
        console.warn(
          '[notifications] ticket-status-change email failed',
          err?.message || err,
        );
      }

      return ticket;
    } catch (error) {
      throw new BadRequestException(
        'Error updating ticket status',
        error.message,
      );
    }
  }

  /**
   * Soft-deletes a ticket along with its notes and any bonuses the ticket created.
   *
   * The audit row is written with the transaction client and propagates on failure, so a
   * tombstone can never exist without its log entry. The exact bonus/note ids are captured
   * into the audit metadata because restore() must revive precisely what this call buried —
   * never rows that were already soft-deleted beforehand.
   */
  async delete(id: string, user: USER, reason?: string): Promise<object> {
    if (
      !user.role.includes('system_admin') &&
      !user.role.includes('system_super_admin')
    ) {
      throw new BadRequestException(
        'Insufficient permissions to delete tickets',
      );
    }

    try {
      const ticket = await this.prisma.ticket.findFirst({
        where: { id, deleted_at: null },
        select: {
          id: true,
          status: true,
          type: true,
          title: true,
          priority: true,
          org_id: true,
          user_id: true,
          staff_id: true,
          created_by: true,
          description: true,
        },
      });

      if (!ticket) {
        throw new BadRequestException('Ticket not found');
      }

      const deletedAt = new Date();

      const { bonusIds, noteIds } = await this.prisma.$transaction(
        async (prisma) => {
          // Bonuses are keyed by staff_id + created_by, so a ticket missing either could
          // never have produced one. Skipping the lookup keeps the old "match nothing"
          // behavior; passing nulls through would make Prisma reject the query outright.
          const bonuses =
            ticket.staff_id && ticket.created_by
              ? await prisma.bonus.findMany({
                  where: {
                    staff_id: ticket.staff_id,
                    created_by: ticket.created_by,
                    deleted_at: null,
                    ...(ticket.description !== null
                      ? { description: ticket.description }
                      : {}),
                  },
                  select: { id: true },
                })
              : [];
          const notes = await prisma.ticketNotes.findMany({
            where: { ticket_id: id, deleted_at: null },
            select: { id: true },
          });

          const bonusIds = bonuses.map((b) => b.id);
          const noteIds = notes.map((n) => n.id);

          await prisma.ticket.update({
            where: { id },
            data: {
              deleted_at: deletedAt,
              deleted_by: user.id,
              deletion_reason: reason ?? null,
            },
          });

          if (bonusIds.length) {
            await prisma.bonus.updateMany({
              where: { id: { in: bonusIds } },
              data: { deleted_at: deletedAt },
            });
          }

          // The TicketNotes FK cascade only fires on a hard DELETE, so notes must be
          // soft-deleted explicitly or they survive as reachable orphans.
          if (noteIds.length) {
            await prisma.ticketNotes.updateMany({
              where: { id: { in: noteIds } },
              data: { deleted_at: deletedAt },
            });
          }

          await this.audit.logOrThrow(
            {
              ticketId: id,
              actorUserId: user.id,
              actorLabel: buildActorLabel(user),
              event: TICKET_AUDIT_EVENTS.DELETED,
              oldStatus: ticket.status,
              newStatus: ticket.status,
              reason: reason ?? null,
              before: {
                status: ticket.status,
                type: ticket.type,
                priority: ticket.priority,
                org_id: ticket.org_id,
                user_id: ticket.user_id,
                staff_id: ticket.staff_id,
                created_by: ticket.created_by,
                ...this.auditSafeTitle(ticket),
              },
              after: {
                deleted_at: deletedAt.toISOString(),
                deleted_by: user.id,
                deletion_reason: reason ?? null,
              },
              metadata: { actorRole: user.role ?? null, bonusIds, noteIds },
            },
            prisma,
          );

          return { bonusIds, noteIds };
        },
      );

      return {
        message: 'Ticket deleted successfully',
        deletedTicket: {
          id: ticket.id,
          type: ticket.type,
          status: ticket.status,
        },
        bonusesDeleted: bonusIds.length,
        notesDeleted: noteIds.length,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error deleting ticket:', error);
      throw new BadRequestException('Error deleting ticket', error.message);
    }
  }

  /**
   * Reverses a soft delete, reviving only the bonuses and notes recorded in the most recent
   * `deleted` audit event. Rows soft-deleted by some other path are deliberately left alone.
   */
  async restore(id: string, user: USER, reason?: string): Promise<object> {
    if (
      !user.role.includes('system_admin') &&
      !user.role.includes('system_super_admin')
    ) {
      throw new BadRequestException(
        'Insufficient permissions to restore tickets',
      );
    }

    try {
      const ticket = await this.prisma.ticket.findFirst({
        where: { id, deleted_at: { not: null } },
        select: {
          id: true,
          status: true,
          type: true,
          deleted_at: true,
          deleted_by: true,
          deletion_reason: true,
        },
      });

      if (!ticket) {
        throw new BadRequestException('Ticket not found or not deleted');
      }

      const lastDeleted = await this.audit.findLastDeletedEvent(id);
      const metadata = (lastDeleted?.metadata ?? {}) as {
        bonusIds?: string[];
        noteIds?: string[];
      };
      const bonusIds = metadata.bonusIds ?? [];
      const noteIds = metadata.noteIds ?? [];

      await this.prisma.$transaction(async (prisma) => {
        await prisma.ticket.update({
          where: { id },
          data: {
            deleted_at: null,
            deleted_by: null,
            deletion_reason: null,
          },
        });

        if (bonusIds.length) {
          await prisma.bonus.updateMany({
            where: { id: { in: bonusIds } },
            data: { deleted_at: null },
          });
        }

        if (noteIds.length) {
          await prisma.ticketNotes.updateMany({
            where: { id: { in: noteIds } },
            data: { deleted_at: null },
          });
        }

        await this.audit.logOrThrow(
          {
            ticketId: id,
            actorUserId: user.id,
            actorLabel: buildActorLabel(user),
            event: TICKET_AUDIT_EVENTS.RESTORED,
            oldStatus: ticket.status,
            newStatus: ticket.status,
            reason: reason ?? null,
            before: {
              deleted_at: ticket.deleted_at?.toISOString() ?? null,
              deleted_by: ticket.deleted_by,
              deletion_reason: ticket.deletion_reason,
            },
            after: { deleted_at: null },
            metadata: {
              actorRole: user.role ?? null,
              bonusesRestored: bonusIds.length,
              notesRestored: noteIds.length,
              // Tickets deleted before this feature shipped have no id manifest to work from.
              ...(lastDeleted ? {} : { idsUnavailable: true }),
            },
          },
          prisma,
        );
      });

      return {
        message: 'Ticket restored successfully',
        restoredTicket: {
          id: ticket.id,
          type: ticket.type,
          status: ticket.status,
        },
        bonusesRestored: bonusIds.length,
        notesRestored: noteIds.length,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error restoring ticket', error.message);
    }
  }

  async update(
    id: string,
    data: {
      title?: string;
      description?: string;
      priority?: Priority;
      type?: string;
      client_id?: string;
      assigned_user_id?: string;
    },
    user: USER,
  ): Promise<object> {
    const currentTicket = await this.prisma.ticket.findFirst({
      where: { id, deleted_at: null },
      select: {
        id: true,
        created_by: true,
        // Captured so the audit event can show what each changed field was before.
        type: true,
        title: true,
        priority: true,
        org_id: true,
        user_id: true,
        organization: { select: { id: true } },
      },
    });
    if (!currentTicket) throw new BadRequestException('Ticket not found');

    // Access control: Organization admins can only update tickets they created
    const isOrganizationAdmin =
      user.role === 'organization_admin' ||
      user.role === 'organization_super_admin';
    if (isOrganizationAdmin) {
      if (
        user.role === 'organization_admin' &&
        currentTicket.created_by !== user.id
      ) {
        throw new ForbiddenException('You can only update tickets you created');
      }
      if (user.role === 'organization_super_admin') {
        // Allow if ticket belongs to their organization OR if they created it
        if (
          currentTicket.organization?.id !== user.organization_id &&
          currentTicket.created_by !== user.id
        ) {
          throw new ForbiddenException(
            'You can only update tickets from your organization or tickets you created',
          );
        }
      }
    }

    const payload: any = {};
    const isSystemAdmin = this.isSystemAdmin(user);

    // All users can update title, description, and priority
    if (typeof data.title === 'string') payload.title = data.title;
    if (typeof data.description === 'string')
      payload.description = data.description;
    if (typeof data.priority === 'string') payload.priority = data.priority;

    // Only system admins can update type, client_id, or assigned_user_id
    if (isSystemAdmin) {
      if (typeof data.type === 'string' && data.type.trim() !== '') {
        const mapped = ticketTypeDictionary[data.type] ?? null;
        if (!mapped) {
          throw new BadRequestException('Invalid ticket type');
        }
        payload.type = mapped;
      }

      if (typeof data.client_id === 'string' && data.client_id.trim() !== '') {
        const org = await this.prisma.organization.findUnique({
          where: { id: data.client_id },
        });
        if (!org) throw new BadRequestException('Organization not found');
        payload.organization = { connect: { id: data.client_id } };
      }

      if (
        typeof data.assigned_user_id === 'string' &&
        data.assigned_user_id.trim() !== ''
      ) {
        const assignee = await this.prisma.uSER.findUnique({
          where: { id: data.assigned_user_id },
        });
        if (!assignee)
          throw new BadRequestException('User to assign not found');
        payload.user = { connect: { id: data.assigned_user_id } };
      }
    }
    // For organization admins, we simply ignore type, client_id, and assigned_user_id
    // They can only update title, description, and priority

    if (Object.keys(payload).length === 0) {
      return await this.findOne(id);
    }

    try {
      const updated = await this.prisma.ticket.update({
        where: { id },
        data: payload,
      });
      if (!updated) throw new BadRequestException('Failed to update ticket');

      const ticket = await this.findOne(id);
      if (!ticket)
        throw new BadRequestException('Failed to fetch updated ticket');

      const changedFields = Object.keys(payload);
      void this.audit.log({
        ticketId: id,
        actorUserId: user?.id ?? null,
        actorLabel: buildActorLabel(user),
        event: TICKET_AUDIT_EVENTS.UPDATED,
        before: {
          ...(changedFields.includes('type') && { type: currentTicket.type }),
          ...(changedFields.includes('title') && {
            ...this.auditSafeTitle(currentTicket),
          }),
          ...(changedFields.includes('priority') && {
            priority: currentTicket.priority,
          }),
          ...(changedFields.includes('organization') && {
            org_id: currentTicket.org_id,
          }),
          ...(changedFields.includes('user') && {
            user_id: currentTicket.user_id,
          }),
        },
        after: {
          ...(changedFields.includes('type') && { type: data.type }),
          ...(changedFields.includes('title') && {
            ...this.auditSafeTitle({
              type: data.type ?? currentTicket.type,
              title: data.title,
            }),
          }),
          ...(changedFields.includes('priority') && {
            priority: data.priority,
          }),
          ...(changedFields.includes('organization') && {
            org_id: data.client_id,
          }),
          ...(changedFields.includes('user') && {
            user_id: data.assigned_user_id,
          }),
        },
        metadata: {
          actorRole: user?.role ?? null,
          changedFields,
        },
      });

      // Notify on generic updates (non-blocking)
      try {
        await this.notifications.notifyTicketEvent(ticket, 'updated');
      } catch (err) {
        console.warn(
          '[notifications] ticket-updated email failed',
          err?.message || err,
        );
      }
      return ticket;
    } catch (error) {
      throw new BadRequestException('Error updating ticket', error.message);
    }
  }

  async addNote(
    ticketId: string,
    dto: { content: string; is_internal?: boolean },
    user: USER,
  ) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, deleted_at: null },
      select: {
        id: true,
        created_by: true,
        organization: { select: { id: true } },
      },
    });
    if (!ticket) {
      throw new BadRequestException('Ticket not found');
    }

    // Access control: Organization admins can only add notes to tickets they created
    const isOrganizationAdmin =
      user.role === 'organization_admin' ||
      user.role === 'organization_super_admin';
    if (isOrganizationAdmin) {
      if (user.role === 'organization_admin' && ticket.created_by !== user.id) {
        throw new ForbiddenException(
          'You can only add notes to tickets you created',
        );
      }
      if (user.role === 'organization_super_admin') {
        // Allow if ticket belongs to their organization OR if they created it
        if (
          ticket.organization?.id !== user.organization_id &&
          ticket.created_by !== user.id
        ) {
          throw new ForbiddenException(
            'You can only add notes to tickets from your organization or tickets you created',
          );
        }
      }
    }

    if ((dto.is_internal ?? false) && !this.isSystemAdmin(user)) {
      throw new ForbiddenException(
        'Only system admins can create internal notes',
      );
    }

    const prismaAny = this.prisma as any;
    let note: any;
    if (prismaAny.ticketNotes?.create) {
      note = await prismaAny.ticketNotes.create({
        data: {
          id: uuidv4(),
          Ticket: { connect: { id: ticketId } },
          USER: { connect: { id: user.id } },
          content: dto.content,
          is_internal: dto.is_internal ?? false,
        },
        include: {
          USER: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              role: true,
            },
          },
        },
      });
    } else {
      const id = uuidv4();
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "TicketNotes" (id, ticket_id, author_id, content, is_internal) VALUES ($1, $2, $3, $4, $5)`,
        id,
        ticketId,
        user.id,
        dto.content,
        dto.is_internal ?? false,
      );
      const rows: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT tn.*, u.id as user_id, u.first_name, u.last_name, u.email, u.role
         FROM "TicketNotes" tn
         JOIN "USER" u ON u.id = tn.author_id
         WHERE tn.id = $1 AND tn.deleted_at IS NULL`,
        id,
      );
      const r = rows?.[0];
      note = r
        ? {
            ...r,
            USER: {
              id: r.user_id,
              first_name: r.first_name,
              last_name: r.last_name,
              email: r.email,
              role: r.role,
            },
          }
        : null;
    }

    // Note content is deliberately not recorded — only its shape.
    void this.audit.log({
      ticketId,
      actorUserId: user?.id ?? null,
      actorLabel: buildActorLabel(user),
      event: TICKET_AUDIT_EVENTS.NOTE_ADDED,
      after: {
        note_id: note?.id ?? null,
        is_internal: dto.is_internal ?? false,
      },
      metadata: {
        actorRole: user?.role ?? null,
        contentLength: dto.content?.length ?? 0,
      },
    });

    // If the note is not internal, notify via email (non-blocking)
    if (!(dto.is_internal ?? false)) {
      try {
        if (ticket.created_by === user.id) {
          // If creator adds a note, notify the assigned user
          await this.notifications.notifyTicketNoteAddedToAssignee(ticketId, {
            content: dto.content,
            author: {
              id: note.USER?.id,
              first_name: note.USER?.first_name,
              last_name: note.USER?.last_name,
              email: note.USER?.email,
            },
          });
        } else {
          // If someone else adds a note, notify the ticket creator
          await this.notifications.notifyTicketNoteAddedToCreator(ticketId, {
            content: dto.content,
            author: {
              id: note.USER?.id,
              first_name: note.USER?.first_name,
              last_name: note.USER?.last_name,
              email: note.USER?.email,
            },
          });
        }
      } catch (err) {
        console.warn(
          '[notifications] ticket-note email failed',
          err?.message || err,
        );
      }
    }

    return note;
  }

  async listNotes(ticketId: string, user: USER) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, deleted_at: null },
      select: {
        id: true,
        created_by: true,
        organization: { select: { id: true } },
      },
    });
    if (!ticket) {
      throw new BadRequestException('Ticket not found');
    }

    // Access control: Organization admins can only view notes for tickets they created
    const isOrganizationAdmin =
      user.role === 'organization_admin' ||
      user.role === 'organization_super_admin';
    if (isOrganizationAdmin) {
      if (user.role === 'organization_admin' && ticket.created_by !== user.id) {
        throw new ForbiddenException(
          'You can only view notes for tickets you created',
        );
      }
      if (user.role === 'organization_super_admin') {
        // Allow if ticket belongs to their organization OR if they created it
        if (
          ticket.organization?.id !== user.organization_id &&
          ticket.created_by !== user.id
        ) {
          throw new ForbiddenException(
            'You can only view notes for tickets from your organization or tickets you created',
          );
        }
      }
    }

    const canSeeInternal = this.isSystemAdmin(user);

    let notes: any[];
    const prismaAnyList = this.prisma as any;
    if (prismaAnyList.ticketNotes?.findMany) {
      notes = await prismaAnyList.ticketNotes.findMany({
        where: {
          ticket_id: ticketId,
          deleted_at: null,
          ...(canSeeInternal ? {} : { is_internal: false }),
        },
        orderBy: { created_at: 'asc' },
        include: {
          USER: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              role: true,
            },
          },
        },
      });
    } else {
      const rows: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT tn.*, u.id as user_id, u.first_name, u.last_name, u.email, u.role
         FROM "TicketNotes" tn
         JOIN "USER" u ON u.id = tn.author_id
         WHERE tn.ticket_id = $1 AND tn.deleted_at IS NULL ${canSeeInternal ? '' : 'AND tn.is_internal = false'}
         ORDER BY tn.created_at ASC`,
        ticketId,
      );
      notes = rows.map((r) => ({
        ...r,
        USER: {
          id: r.user_id,
          first_name: r.first_name,
          last_name: r.last_name,
          email: r.email,
          role: r.role,
        },
      }));
    }

    return notes.map((n) => ({
      ...n,
      author_name:
        `${n.USER?.first_name ?? ''} ${n.USER?.last_name ?? ''}`.trim(),
      author_role: n.USER?.role ?? null,
    }));
  }

  async listAuditLogs(query: ListTicketAuditLogsDto) {
    return this.audit.findAllLogs(query);
  }

  async getTicketAuditLog(ticketId: string) {
    // Deliberately unfiltered: the timeline of a soft-deleted ticket is exactly what this
    // endpoint exists to expose.
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true },
    });
    if (!ticket) throw new BadRequestException('Ticket not found');

    return this.audit.findByTicket(ticketId);
  }
}
