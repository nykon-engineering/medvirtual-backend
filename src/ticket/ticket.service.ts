import { BadRequestException, Injectable, ForbiddenException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

import { CreateTicketDto } from './dto/create-ticket.dto';
import { Priority, TicketStatus, USER } from '@prisma/client';
import { ticketTypeDictionary } from '../common/dictionaries/ticket-type';
import { reassignTicketDto } from './dto/reassign-ticket.dto';

@Injectable()
export class TicketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private isSystemAdmin(user: USER) {
    return user?.role === 'system_admin' || user?.role === 'system_super_admin';
  }

  async findOne(id: string, user?: USER): Promise<any> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
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
      },
    });

    if (!ticket) {
      throw new BadRequestException('Ticket not found');
    }

    // Access control: Organization admins can only see tickets they created
    if (user) {
      const isOrganizationAdmin = user.role === 'organization_admin' || user.role === 'organization_super_admin';
      if (isOrganizationAdmin) {
        // For organization_super_admin, allow tickets from their organization
        // For organization_admin, only allow tickets they created
        if (user.role === 'organization_admin' && ticket.created_by !== user.id) {
          throw new ForbiddenException('You can only view tickets you created');
        }
        if (user.role === 'organization_super_admin') {
          // Allow if ticket belongs to their organization OR if they created it
          if (ticket.organization?.id !== user.organization_id && ticket.created_by !== user.id) {
            throw new ForbiddenException('You can only view tickets from your organization or tickets you created');
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
      (createTicketDto.type === 'hire_request_cancellation' ) &&
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
    if (createTicketDto.type === 'Support' || createTicketDto.type === 'hire_request_cancellation') {
      assignedValidatedUser = createTicketDto.assigned_user_id;
      assignedValidatedOrg = createTicketDto.client_id;
    } else {
      // For other ticket types, organization is required
      if (!user || (user.role.includes('organization') && !user.organization_id))
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
        assignedValidatedUser = createTicketDto.assigned_user_id;
        assignedValidatedOrg = createTicketDto.client_id;
      }
    }

    // Validate that the user creating the ticket exists
    const creatorUser = await this.prisma.uSER.findUnique({
      where: { id: user.id },
    });
    if (!creatorUser) {
      throw new BadRequestException(`User with ID ${user.id} not found. Cannot create ticket.`);
    }

    // Validate that the assigned user exists (if provided)
    if (assignedValidatedUser) {
      const assignedUser = await this.prisma.uSER.findUnique({
        where: { id: assignedValidatedUser },
      });
      if (!assignedUser) {
        throw new BadRequestException(`Assigned user with ID ${assignedValidatedUser} not found.`);
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

      // Notify assignee via email (non-blocking)
      try {
        await this.notifications.notifyTicketEvent(ticketFull, 'created');
      } catch (err) {
        console.warn('[notifications] ticket-created email failed', err?.message || err);
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
  ): Promise<object> {
    try {
      // Calculate date 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const tickets = await this.prisma.ticket.findMany({
        where: {
          type: type ? type : undefined,
          priority: priority ? priority as Priority : undefined,
          ...(user.role === 'system_super_admin' ? {} : 
              user.role === 'system_admin' ? {
                OR: [
                  { user: { is: { id: user.id } } },
                  { created_by: user.id }
                ]
              } : user.role === 'organization_super_admin' ? {
                organization: user.organization_id ? { id: user.organization_id } : undefined
              } : user.role === 'organization_admin' ? {
                created_by: user.id
              } : { user: { is: { id: user.id } } }),
          ...(search ? {
            OR: [
              { organization: { name: { contains: search, mode: 'insensitive' } } },
              { title: { contains: search, mode: 'insensitive' } }
            ]
          } : {}),
          
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
        },
      });
      if (!tickets) throw new BadRequestException('Failed to fetch tickets');

      const filteredTickets = tickets.map((ticket: any) => ({
        ...ticket,
        candidate: ticket.candidate ? {
          ...ticket.candidate,
          avatar: ticket.candidate.avatar_url ? `${process.env.AVATAR_URL}${ticket.candidate.avatar_url}` :  null,
        }: null,
        staff: ticket.staff ? {
          ...ticket.staff,
          candidate: ticket.staff.candidate ? {
            ...ticket.staff.candidate,
            avatar: ticket.staff.candidate.avatar_url ? `${process.env.AVATAR_URL}${ticket.staff.candidate.avatar_url}` :  null,
          } : null,
        } : null,
      }))

      return filteredTickets;
    } catch (error) {
      throw new BadRequestException('Error fetching tickets');
    }
  }

  async reassing(id: string, data: reassignTicketDto): Promise<object> {
    try {
      const currentTicket = await this.prisma.ticket.findUnique({
        where: { id },
        select: {
          status: true,
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

      // Notify assignee via email (non-blocking)
      try {
        await this.notifications.notifyTicketEvent(ticket, 'assigned');
      } catch (err) {
        console.warn('[notifications] ticket-assigned email failed', err?.message || err);
      }

      return ticket;
    } catch (error) {
      throw new BadRequestException('Error reassigning ticket', error.message);
    }
  }

  async updateStatus(id: string, data: { status: string }): Promise<object> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
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
        `Status ${data.status.replace('_', ' ').toUpperCase()} requires an assigned user`,
      );
    if (
      data.status === 'resolved' &&
      ticket.type === 'termination' &&
      ticket.staff?.id
    ) {
      //terminate the staff => update staff status to terminated and terminated staff
      await this.prisma.staff.update({
        where: {
          id: ticket.staff.id,
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

      // Notify creator on status change to in_progress, resolved, or closed (non-blocking)
      try {
        if (data.status === 'in_progress' || data.status === 'resolved' || data.status === 'closed') {
          await this.notifications.notifyTicketStatusChangeToCreator(ticket, data.status as 'in_progress' | 'resolved' | 'closed');
        } else if (oldStatus === 'closed' && data.status === 'new') {
          // Notify when ticket is reopened from closed to new
          await this.notifications.notifyTicketReopened(ticket);
        }
      } catch (err) {
        console.warn('[notifications] ticket-status-change email failed', err?.message || err);
      }

      return ticket;
    } catch (error) {
      throw new BadRequestException(
        'Error updating ticket status',
        error.message,
      );
    }
  }

  async delete(id: string, user: USER): Promise<object> {
    if (
      !user.role.includes('system_admin') &&
      !user.role.includes('system_super_admin')
    ) {
      throw new BadRequestException(
        'Insufficient permissions to delete tickets',
      );
    }

    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          type: true,
        },
      });

      if (!ticket) {
        throw new BadRequestException('Ticket not found');
      }

      await this.prisma.ticket.delete({
        where: { id },
      });

      return {
        message: 'Ticket deleted successfully',
        deletedTicket: {
          id: ticket.id,
          type: ticket.type,
          status: ticket.status,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error deleting ticket', error.message);
    }
  }

  async update(id: string, data: { title?: string; description?: string; priority?: Priority; type?: string; client_id?: string; assigned_user_id?: string }, user: USER): Promise<object> {
    const currentTicket = await this.prisma.ticket.findUnique({
      where: { id },
      select: { id: true, created_by: true, organization: { select: { id: true } } },
    });
    if (!currentTicket) throw new BadRequestException('Ticket not found');

    // Access control: Organization admins can only update tickets they created
    const isOrganizationAdmin = user.role === 'organization_admin' || user.role === 'organization_super_admin';
    if (isOrganizationAdmin) {
      if (user.role === 'organization_admin' && currentTicket.created_by !== user.id) {
        throw new ForbiddenException('You can only update tickets you created');
      }
      if (user.role === 'organization_super_admin') {
        // Allow if ticket belongs to their organization OR if they created it
        if (currentTicket.organization?.id !== user.organization_id && currentTicket.created_by !== user.id) {
          throw new ForbiddenException('You can only update tickets from your organization or tickets you created');
        }
      }
    }

    const payload: any = {};
    const isSystemAdmin = this.isSystemAdmin(user);
    
    // All users can update title, description, and priority
    if (typeof data.title === 'string') payload.title = data.title;
    if (typeof data.description === 'string') payload.description = data.description;
    if (typeof data.priority === 'string') payload.priority = data.priority as Priority;

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
        const org = await this.prisma.organization.findUnique({ where: { id: data.client_id } });
        if (!org) throw new BadRequestException('Organization not found');
        payload.organization = { connect: { id: data.client_id } };
      }

      if (typeof data.assigned_user_id === 'string' && data.assigned_user_id.trim() !== '') {
        const assignee = await this.prisma.uSER.findUnique({ where: { id: data.assigned_user_id } });
        if (!assignee) throw new BadRequestException('User to assign not found');
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
      if (!ticket) throw new BadRequestException('Failed to fetch updated ticket');
      // Notify on generic updates (non-blocking)
      try {
        await this.notifications.notifyTicketEvent(ticket, 'updated');
      } catch (err) {
        console.warn('[notifications] ticket-updated email failed', err?.message || err);
      }
      return ticket;
    } catch (error) {
      throw new BadRequestException('Error updating ticket', error.message);
    }
  }

  async addNote(ticketId: string, dto: { content: string; is_internal?: boolean }, user: USER) {
    const ticket = await this.prisma.ticket.findUnique({ 
      where: { id: ticketId },
      select: { id: true, created_by: true, organization: { select: { id: true } } },
    });
    if (!ticket) {
      throw new BadRequestException('Ticket not found');
    }

    // Access control: Organization admins can only add notes to tickets they created
    const isOrganizationAdmin = user.role === 'organization_admin' || user.role === 'organization_super_admin';
    if (isOrganizationAdmin) {
      if (user.role === 'organization_admin' && ticket.created_by !== user.id) {
        throw new ForbiddenException('You can only add notes to tickets you created');
      }
      if (user.role === 'organization_super_admin') {
        // Allow if ticket belongs to their organization OR if they created it
        if (ticket.organization?.id !== user.organization_id && ticket.created_by !== user.id) {
          throw new ForbiddenException('You can only add notes to tickets from your organization or tickets you created');
        }
      }
    }

    if ((dto.is_internal ?? false) && !this.isSystemAdmin(user)) {
      throw new ForbiddenException('Only system admins can create internal notes');
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
          USER: { select: { id: true, first_name: true, last_name: true, email: true, role: true } },
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
         WHERE tn.id = $1`,
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
        console.warn('[notifications] ticket-note email failed', err?.message || err);
      }
    }

    return note;
  }

  async listNotes(ticketId: string, user: USER) {
    const ticket = await this.prisma.ticket.findUnique({ 
      where: { id: ticketId },
      select: { id: true, created_by: true, organization: { select: { id: true } } },
    });
    if (!ticket) {
      throw new BadRequestException('Ticket not found');
    }

    // Access control: Organization admins can only view notes for tickets they created
    const isOrganizationAdmin = user.role === 'organization_admin' || user.role === 'organization_super_admin';
    if (isOrganizationAdmin) {
      if (user.role === 'organization_admin' && ticket.created_by !== user.id) {
        throw new ForbiddenException('You can only view notes for tickets you created');
      }
      if (user.role === 'organization_super_admin') {
        // Allow if ticket belongs to their organization OR if they created it
        if (ticket.organization?.id !== user.organization_id && ticket.created_by !== user.id) {
          throw new ForbiddenException('You can only view notes for tickets from your organization or tickets you created');
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
          ...(canSeeInternal ? {} : { is_internal: false }),
        },
        orderBy: { created_at: 'asc' },
        include: {
          USER: { select: { id: true, first_name: true, last_name: true, email: true, role: true } },
        },
      });
    } else {
      const rows: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT tn.*, u.id as user_id, u.first_name, u.last_name, u.email, u.role
         FROM "TicketNotes" tn
         JOIN "USER" u ON u.id = tn.author_id
         WHERE tn.ticket_id = $1 ${canSeeInternal ? '' : 'AND tn.is_internal = false'}
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
      author_name: `${n.USER?.first_name ?? ''} ${n.USER?.last_name ?? ''}`.trim(),
      author_role: n.USER?.role ?? null,
    }));
  }
}
