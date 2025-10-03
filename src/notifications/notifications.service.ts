import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { EmailFooter, EmailHeader } from '../common/utils/email-templates/components';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  private buildEmail(htmlInner: string): string {
    return `<!DOCTYPE html><html><body><div style="max-width:600px;margin:0 auto;background:#ffffff;">${EmailHeader}<div style="padding:24px;">${htmlInner}</div>${EmailFooter}</div></body></html>`;
  }

  async notifyHireRequestPlacementCompleted(hireRequestId: string): Promise<boolean> {
    const hr = await this.prisma.hireRequest.findUnique({
      where: { id: hireRequestId },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        specialization: true,
        location: true,
        salary_range_from: true,
        salary_range_to: true,
        expected_start_date: true,
        assigned_user: {
          select: { email: true, first_name: true, last_name: true },
        },
        organization: {
          select: { name: true },
        },
      },
    });
    if (!hr) throw new NotFoundException('Hire request not found');
    if (!hr.assigned_user?.email)
      throw new BadRequestException('Hire request has no assignee email');

    const detailUrl = `${process.env.FRONTEND_URL}/hire-requests?request=${hr.id}`;
    const salaryRange = hr.salary_range_from && hr.salary_range_to 
      ? `$${hr.salary_range_from} - $${hr.salary_range_to}`
      : 'Not specified';
    const startDate = hr.expected_start_date 
      ? new Date(hr.expected_start_date).toLocaleDateString()
      : 'Not specified';

    const html = this.buildEmail(
      `<h2>Placement Completed</h2>
       <p>The hire request has been marked as <strong>placement completed</strong>.</p>
       
       <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
         <h3 style="margin-top: 0; color: #333;">Hire Request Details</h3>
         <p><strong>Title:</strong> ${hr.title}</p>
         <p><strong>Organization:</strong> ${hr.organization.name}</p>
         <p><strong>Description:</strong> ${hr.description || 'No description provided'}</p>
         <p><strong>Specialization:</strong> ${hr.specialization}</p>
         <p><strong>Priority:</strong> ${hr.priority}</p>
         <p><strong>Location:</strong> ${hr.location || 'Not specified'}</p>
         <p><strong>Salary Range:</strong> ${salaryRange}</p>
         <p><strong>Expected Start Date:</strong> ${startDate}</p>
       </div>
       
       <p>Please proceed with onboarding steps.</p>
       <p style="margin-top: 20px;">
         <a href="${detailUrl}" style="background-color: #01546B; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
           View Hire Request Details
         </a>
       </p>`,
    );

    return await this.mail.sendMail({
      from: 'MedVirtual <noreply@medvirtual.ai>',
      to: [hr.assigned_user.email],
      subject: `Placement completed: ${hr.title}`,
      html,
    });
  }

  async notifyHireRequestClientChange(hireRequestId: string, action: 'edited' | 'canceled'): Promise<boolean> {
    const hr = await this.prisma.hireRequest.findUnique({
      where: { id: hireRequestId },
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        specialization: true,
        location: true,
        assigned_user: { select: { email: true } },
        organization: {
          select: { name: true },
        },
      },
    });
    if (!hr) throw new NotFoundException('Hire request not found');
    if (!hr.assigned_user?.email)
      throw new BadRequestException('Hire request has no assignee email');

    const verb = action === 'edited' ? 'edited' : 'canceled';
    const detailUrl = `${process.env.FRONTEND_URL}/hire-requests?request=${hr.id}`;
    const html = this.buildEmail(
      `<h2>Hire Request ${verb.toUpperCase()}</h2>
       <p>The hire request was ${verb} by the client.</p>
       
       <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
         <h3 style="margin-top: 0; color: #333;">Hire Request Details</h3>
         <p><strong>Title:</strong> ${hr.title}</p>
         <p><strong>Organization:</strong> ${hr.organization.name}</p>
         <p><strong>Description:</strong> ${hr.description || 'No description provided'}</p>
         <p><strong>Specialization:</strong> ${hr.specialization}</p>
         <p><strong>Priority:</strong> ${hr.priority}</p>
         <p><strong>Location:</strong> ${hr.location || 'Not specified'}</p>
       </div>
       
       <p style="margin-top: 20px;">
         <a href="${detailUrl}" style="background-color: #01546B; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
           View Hire Request Details
         </a>
       </p>`,
    );

    return await this.mail.sendMail({
      from: 'MedVirtual <noreply@medvirtual.ai>',
      to: [hr.assigned_user.email],
      subject: `Hire Request ${verb}: ${hr.title}`,
      html,
    });
  }

  async notifyHireRequestCreated(hireRequestId: string): Promise<boolean> {
    const hr = await this.prisma.hireRequest.findUnique({
      where: { id: hireRequestId },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        specialization: true,
        location: true,
        salary_range_from: true,
        salary_range_to: true,
        expected_start_date: true,
        availability: true,
        contract_length: true,
        assigned_user: {
          select: { email: true, first_name: true, last_name: true },
        },
        organization: {
          select: { name: true },
        },
      },
    });
    if (!hr) throw new NotFoundException('Hire request not found');
    if (!hr.assigned_user?.email)
      throw new BadRequestException('Hire request has no assignee email');

    const detailUrl = `${process.env.FRONTEND_URL}/hire-requests?request=${hr.id}`;
    const salaryRange = hr.salary_range_from && hr.salary_range_to 
      ? `$${hr.salary_range_from} - $${hr.salary_range_to}`
      : 'Not specified';
    const startDate = hr.expected_start_date 
      ? new Date(hr.expected_start_date).toLocaleDateString()
      : 'Not specified';

    const html = this.buildEmail(
      `<h2>New Hire Request Assigned</h2>
       <p>You have been assigned a new hire request that requires your attention.</p>
       
       <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
         <h3 style="margin-top: 0; color: #333;">Hire Request Details</h3>
         <p><strong>Title:</strong> ${hr.title}</p>
         <p><strong>Organization:</strong> ${hr.organization.name}</p>
         <p><strong>Description:</strong> ${hr.description || 'No description provided'}</p>
         <p><strong>Specialization:</strong> ${hr.specialization}</p>
         <p><strong>Priority:</strong> ${hr.priority}</p>
         <p><strong>Location:</strong> ${hr.location || 'Not specified'}</p>
         <p><strong>Availability:</strong> ${hr.availability}</p>
         <p><strong>Contract Length:</strong> ${hr.contract_length || 'Not specified'}</p>
         <p><strong>Salary Range:</strong> ${salaryRange}</p>
         <p><strong>Expected Start Date:</strong> ${startDate}</p>
         <p><strong>Status:</strong> ${hr.status}</p>
       </div>
       
       <p>Please review the details and take appropriate action.</p>
       <p style="margin-top: 20px;">
         <a href="${detailUrl}" style="background-color: #01546B; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
           View Hire Request Details
         </a>
       </p>`,
    );

    return await this.mail.sendMail({
      from: 'MedVirtual <noreply@medvirtual.ai>',
      to: [hr.assigned_user.email],
      subject: `New Hire Request Assigned: ${hr.title}`,
      html,
    });
  }

  async notifyTicketEvent(ticketId: string, event: 'created' | 'assigned' | 'canceled'): Promise<boolean> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        type: true,
        createdAt: true,
        user: { select: { email: true } }, // assignee
        organization: {
          select: { name: true },
        },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const to = ticket.user?.email ? [ticket.user.email] : undefined;
    if (!to || to.length === 0) throw new BadRequestException('Ticket has no assignee email');

    const detailUrl = `${process.env.FRONTEND_URL}/tickets?ticket=${ticket.id}`;
    const createdDate = new Date(ticket.createdAt).toLocaleDateString();
    
    const html = this.buildEmail(
      `<h2>Ticket ${event.toUpperCase()}</h2>
       <p>The ticket was ${event}.</p>
       
       <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
         <h3 style="margin-top: 0; color: #333;">Ticket Details</h3>
         <p><strong>Title:</strong> ${ticket.title}</p>
         <p><strong>Organization:</strong> ${ticket.organization.name}</p>
         <p><strong>Description:</strong> ${ticket.description}</p>
         <p><strong>Type:</strong> ${ticket.type}</p>
         <p><strong>Priority:</strong> ${ticket.priority}</p>
         <p><strong>Status:</strong> ${ticket.status}</p>
         <p><strong>Created:</strong> ${createdDate}</p>
       </div>
       
       <p style="margin-top: 20px;">
         <a href="${detailUrl}" style="background-color: #01546B; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
           View Ticket Details
         </a>
       </p>`,
    );

    return await this.mail.sendMail({
      from: 'MedVirtual <noreply@medvirtual.ai>',
      to,
      subject: `Ticket ${event}: ${ticket.title}`,
      html,
    });
  }
}


