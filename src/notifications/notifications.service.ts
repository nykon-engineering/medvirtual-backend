import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { getEmailFooter, getEmailHeader } from '../common/utils/email-templates/components';
import { getUserEmailTheme } from '../common/utils/email-templates/theme-helper';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) { }

  private buildEmail(htmlInner: string, theme?: any): string {
    const primaryColor = theme?.primaryColor || '#01546B';
    const companyName = theme?.companyName || 'MedVirtual';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${companyName} Notification</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    .email-wrapper {
      background-color: #f4f4f4;
      padding: 20px;
      min-height: 100vh;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .content {
      padding: 40px 30px;
    }
    .logo {
      text-align: left;
      margin-bottom: 30px;
    }
    .logo img {
      max-width: 200px;
      height: auto;
    }
    .greeting {
      color: #333333;
      font-size: 16px;
      margin-bottom: 20px;
    }
    .main-message {
      color: #333333;
      font-size: 16px;
      line-height: 1.5;
      margin-bottom: 30px;
    }
    .cta-button {
      display: inline-block;
      background-color: ${primaryColor};
      color: #ffffff !important;
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 30px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
      transition: background-color 0.2s ease;
    }
    .cta-button:hover {
      background-color: ${theme?.primaryColorHover || '#013A4F'};
      color: #ffffff !important;
    }
    .cta-button:visited {
      color: #ffffff !important;
    }
    .cta-button:link {
      color: #ffffff !important;
    }
    .closing {
      color: #333333;
      font-size: 16px;
      margin: 30px 0 10px 0;
    }
    .sender {
      color: #333333;
      font-size: 16px;
    }
    .footer {
      border-top: 1px solid #e9ecef;
      padding: 20px 30px;
      margin-top: 30px;
    }
    .footer-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .support-text {
      color: #666666;
      font-size: 14px;
      margin: 0;
    }
    .support-email {
      color: ${primaryColor};
      text-decoration: none;
      font-size: 14px;
    }
    .support-email-highlight {
      background-color: #fff3cd;
      padding: 1px 3px;
      border-radius: 2px;
    }
    
  </style>
</head>

<body>
  <div class="email-wrapper">
    <div class="container">
      <div class="content">
        <div class="logo">
              <img src="https://staging.medvirtual.ai/${theme?.companyName === 'Berry Virtual' ? 'logobv.png' : 'logo.png'}" alt="${companyName} Logo" />
        </div>
      
      <div class="greeting">Hi,</div>
      
      <div class="main-message">
        ${htmlInner}
      </div>
      
      <div class="closing">Best,</div>
      <div class="sender">
        <strong>${companyName}</strong> team
      </div>
    </div>
    
    
  </div>
</body>
</html>`;
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
        salary_range_from: true,
        salary_range_to: true,
        expected_start_date: true,
        assigned_user: {
          select: { id: true, email: true, first_name: true, last_name: true },
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

    // Get user email theme
    const emailTheme = await getUserEmailTheme(this.prisma, hr.assigned_user.id);

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
         <p><strong>Salary Range:</strong> ${salaryRange}</p>
         <p><strong>Expected Start Date:</strong> ${startDate}</p>
       </div>
       
       <p>Please proceed with onboarding steps.</p>
       <p style="margin-top: 20px;">
         <a href="${detailUrl}" style="background-color: ${emailTheme?.primaryColor || '#01546B'}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
           View Hire Request Details
         </a>
       </p>`,
      emailTheme
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
        assigned_user: { select: { id: true, email: true } },
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

    // Get user email theme
    const emailTheme = await getUserEmailTheme(this.prisma, hr.assigned_user.id);

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
       </div>
       
       <p style="margin-top: 20px;">
         <a href="${detailUrl}" style="background-color: ${emailTheme?.primaryColor || '#01546B'}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
           View Hire Request Details
         </a>
       </p>`,
      emailTheme
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
        salary_range_from: true,
        salary_range_to: true,
        expected_start_date: true,
        availability: true,
        contract_length: true,
        assigned_user: {
          select: { id: true, email: true, first_name: true, last_name: true },
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

    // Get user email theme
    const emailTheme = await getUserEmailTheme(this.prisma, hr.assigned_user.id);

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
         <p><strong>Availability:</strong> ${hr.availability}</p>
         <p><strong>Contract Length:</strong> ${hr.contract_length || 'Not specified'}</p>
         <p><strong>Salary Range:</strong> ${salaryRange}</p>
         <p><strong>Expected Start Date:</strong> ${startDate}</p>
         <p><strong>Status:</strong> ${hr.status}</p>
       </div>
       
       <p>Please review the details and take appropriate action.</p>
       <p style="margin-top: 20px;">
         <a href="${detailUrl}" style="background-color: ${emailTheme?.primaryColor || '#01546B'}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
           View Hire Request Details
         </a>
       </p>`,
      emailTheme
    );

    return await this.mail.sendMail({
      from: 'MedVirtual <noreply@medvirtual.ai>',
      to: [hr.assigned_user.email],
      subject: `New Hire Request Assigned: ${hr.title}`,
      html,
    });
  }

  async notifyTicketEvent(ticketId: string, event: 'created' | 'assigned' | 'closed'): Promise<boolean> {
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
        user: { select: { id: true, email: true } }, // assignee
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

    // Get user email theme
    const emailTheme = ticket.user ? await getUserEmailTheme(this.prisma, ticket.user.id) : null;

    const html = this.buildEmail(
      `<h2>Ticket ${event.toUpperCase()}</h2>
       <p>The ticket was ${event}.</p>
       
       <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
         <h3 style="margin-top: 0; color: #333;">Ticket Details</h3>
         <p><strong>Title:</strong> ${ticket.title}</p>
         <p><strong>Organization:</strong> ${ticket.organization?.name || 'N/A'}</p>
         <p><strong>Description:</strong> ${ticket.description}</p>
         <p><strong>Type:</strong> ${ticket.type}</p>
         <p><strong>Priority:</strong> ${ticket.priority}</p>
         <p><strong>Status:</strong> ${ticket.status}</p>
         <p><strong>Created:</strong> ${createdDate}</p>
       </div>
       
       <p style="margin-top: 20px;">
         <a href="${detailUrl}" style="background-color: ${emailTheme?.primaryColor || '#01546B'}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
           View Ticket Details
         </a>
       </p>`,
      emailTheme
    );

    return await this.mail.sendMail({
      from: 'MedVirtual <noreply@medvirtual.ai>',
      to,
      subject: `Ticket ${event}: ${ticket.title}`,
      html,
    });
  }
}


