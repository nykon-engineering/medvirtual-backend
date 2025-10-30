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
      background-color: ${theme?.primaryColor || primaryColor};
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

  async notifyHireRequestPlacementCompleted(hireRequestId: string, winnerCandidateId?: string): Promise<boolean> {
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
        panels: {
          select: {
            id: true,
            panelCandidates: {
              where: winnerCandidateId ? { candidate_id: winnerCandidateId } : { status: 'selected_by_client' },
              select: {
                candidate: {
                  select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                    name: true,
                  },
                },
              },
            },
          },
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

    // Get winner candidate name
    const winnerCandidate = hr.panels?.[0]?.panelCandidates?.[0]?.candidate;
    const winnerName = winnerCandidate
      ? (winnerCandidate.name || `${winnerCandidate.first_name || ''} ${winnerCandidate.last_name || ''}`.trim() || 'Unknown')
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
         <p><strong>Selected Candidate:</strong> ${winnerName}</p>
       </div>
       
        <p>Please proceed with onboarding steps.</p>
        <div style="text-align: left; margin: 30px 0;">
          <a href="${detailUrl}" class="cta-button">
            View Hire Request Details
          </a>
        </div>`,
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
       
       <div style="text-align: left; margin: 30px 0;">
         <a href="${detailUrl}" class="cta-button">
           View Hire Request Details
         </a>
       </div>`,
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
       <div style="text-align: left; margin: 30px 0;">
         <a href="${detailUrl}" class="cta-button">
           View Hire Request Details
         </a>
       </div>`,
      emailTheme
    );

    return await this.mail.sendMail({
      from: 'MedVirtual <noreply@medvirtual.ai>',
      to: [hr.assigned_user.email],
      subject: `New Hire Request Assigned: ${hr.title}`,
      html,
    });
  }

  async notifyTicketEvent(ticket: any, event: 'created' | 'assigned' | 'closed'): Promise<boolean> {

    if (!ticket) throw new NotFoundException('Ticket not found');

    const to = ticket.user?.email ? [ticket.user.email] : undefined;
    if (!to || to.length === 0) throw new BadRequestException('Ticket has no assignee email');

    const detailUrl = `${process.env.FRONTEND_URL}/tickets?ticket=${ticket.id}`;
    const createdDate = new Date(ticket.createdAt).toLocaleDateString();

    // Get user email theme
    const emailTheme = ticket.user ? await getUserEmailTheme(this.prisma, ticket.user.id) : null;

    // Build staff member details if available
    let staffDetails = '';
    if (ticket.staff?.candidate) {
      const staffName = `${ticket.staff.candidate.name}`.trim() || 'Unknown';
      staffDetails = `
         <p><strong>Staff Member:</strong> ${staffName}</p>
         <p><strong>Staff Email:</strong> ${ticket.staff.candidate.email || 'N/A'}</p>`;
    }

    // Build candidate details if available
    let candidateDetails = '';
    if (ticket.candidate) {
      const staffName = `${ticket.candidate.name || ' '}`.trim() || 'Unknown';
      candidateDetails = `
         <p><strong>Candidate Member:</strong> ${staffName}</p>
         <p><strong>Candidate Email:</strong> ${ticket.candidate.email || 'N/A'}</p>`;
    }


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
         <p><strong>Created:</strong> ${createdDate}</p>${staffDetails}${candidateDetails}
       </div>
       
       <div style="text-align: left; margin: 30px 0;">
         <a href="${detailUrl}" class="cta-button">
           View Ticket Details
         </a>
       </div>`,
      emailTheme
    );

    return await this.mail.sendMail({
      from: 'MedVirtual <noreply@medvirtual.ai>',
      to,
      subject: `Ticket ${event}: ${ticket.title}`,
      html,
    });
  }

  async notifyHireRequestSelectWinner(hireRequestId: string): Promise<boolean> {
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
        organization: {
          select: { 
            id: true,
            name: true,
            business_unit: true,
            admin: {
              select: { id: true, email: true, first_name: true, last_name: true }
            },
            owner: {
              select: { id: true, email: true, first_name: true, last_name: true }
            }
          },
        },
        panels: {
          select: {
            id: true,
            panelCandidates: {
              where: { status: 'selected_by_client' },
              select: {
                candidate: {
                  select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!hr) throw new NotFoundException('Hire request not found');

    // Get organization admin and super admin users
    const organizationAdmins = await this.prisma.uSER.findMany({
      where: {
        organization_id: hr.organization.id,
        role: { in: ['organization_admin', 'organization_super_admin'] },
        status: 'active',
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
      },
    });

    // Also include organization admin and owner if they exist
    const additionalRecipients: any[] = [];
    if (hr.organization.admin && hr.organization.admin.email) {
      additionalRecipients.push(hr.organization.admin);
    }
    if (hr.organization.owner && hr.organization.owner.email) {
      additionalRecipients.push(hr.organization.owner);
    }

    // Combine all recipients and remove duplicates
    const allRecipients = [...organizationAdmins, ...additionalRecipients];
    const uniqueRecipients = allRecipients.filter((recipient, index, self) => 
      index === self.findIndex(r => r.email === recipient.email)
    );

    if (uniqueRecipients.length === 0) {
      throw new BadRequestException('No organization admins found to notify');
    }

    const detailUrl = `${process.env.FRONTEND_URL}/hire-requests?request=${hr.id}`;
    const salaryRange = hr.salary_range_from && hr.salary_range_to
      ? `$${hr.salary_range_from} - $${hr.salary_range_to}`
      : 'Not specified';
    const startDate = hr.expected_start_date
      ? new Date(hr.expected_start_date).toLocaleDateString()
      : 'Not specified';

    // Get winner candidate name
    const winnerCandidate = hr.panels?.[0]?.panelCandidates?.[0]?.candidate;
    const winnerName = winnerCandidate
      ? (winnerCandidate.name || `${winnerCandidate.first_name || ''} ${winnerCandidate.last_name || ''}`.trim() || 'Unknown')
      : 'Not specified';

    // Send notification to each recipient
    const emailPromises = uniqueRecipients.map(async (recipient) => {
      // Get user email theme
      const emailTheme = await getUserEmailTheme(this.prisma, recipient.id);

      // Determine company name based on organization business unit
      const companyName = hr.organization.business_unit === 'Berry Virtual' ? 'Berry Virtual' : 'MedVirtual';
      const fromEmail = companyName === 'Berry Virtual' ? 'Berry Virtual <noreply@medvirtual.ai>' : 'MedVirtual <noreply@medvirtual.ai>';

      const html = this.buildEmail(
        `<h2>Hire Request Status Update</h2>
         <p>Your hire request has been completed.</p>
         
         <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
           <h3 style="margin-top: 0; color: #333;">Hire Request Details</h3>
           <p><strong>Title:</strong> ${hr.title}</p>
           <p><strong>Organization:</strong> ${hr.organization.name}</p>
           <p><strong>Description:</strong> ${hr.description || 'No description provided'}</p>
           <p><strong>Specialization:</strong> ${hr.specialization}</p>
           <p><strong>Priority:</strong> ${hr.priority}</p>
           <p><strong>Salary Range:</strong> ${salaryRange}</p>
           <p><strong>Expected Start Date:</strong> ${startDate}</p>
           <p><strong>Selected Candidate:</strong> ${winnerName}</p>
         </div>
         
         <p>Please review the details and proceed with the next steps.</p>
         <div style="text-align: left; margin: 30px 0;">
           <a href="${detailUrl}" class="cta-button">
             Review Hire Request
           </a>
         </div>`,
        emailTheme
      );

      return this.mail.sendMail({
        from: fromEmail,
        to: [recipient.email],
        subject: `Hire Request Completed: ${hr.title}.`,  
        html,
      });
    });

    // Wait for all emails to be sent
    const results = await Promise.all(emailPromises);
    
    // Return true if at least one email was sent successfully
    return results.some(result => result === true);
  }

  async notifyTicketNoteAddedToCreator(ticketId: string, note: { content: string; author?: { id?: string; first_name?: string; last_name?: string; email?: string } }): Promise<boolean> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        title: true,
        organization: { select: { name: true } },
        created_by: true,
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    if (!ticket.created_by) throw new BadRequestException('Ticket has no creator');

    const creator = await this.prisma.uSER.findUnique({
      where: { id: ticket.created_by },
      select: { id: true, email: true, first_name: true, last_name: true },
    });
    if (!creator?.email) throw new BadRequestException('Ticket creator has no email');

    const detailUrl = `${process.env.FRONTEND_URL}/tickets?ticket=${ticket.id}`;

    const emailTheme = await getUserEmailTheme(this.prisma, creator.id);

    const authorName = `${note.author?.first_name ?? ''} ${note.author?.last_name ?? ''}`.trim() || 'A user';

    const html = this.buildEmail(
      `<h2>New Note on Your Ticket</h2>
       <p>A new note was added to your ticket by <strong>${authorName}</strong>.</p>
       <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
         <h3 style="margin-top: 0; color: #333;">Ticket</h3>
         <p><strong>Title:</strong> ${ticket.title}</p>
         <p><strong>Organization:</strong> ${ticket.organization?.name || 'N/A'}</p>
       </div>
       <div style="background-color: #fff; border: 1px solid #eee; padding: 15px; border-radius: 8px;">
         <h3 style="margin-top: 0; color: #333;">Note</h3>
         <p style="white-space: pre-wrap;">${note.content}</p>
       </div>
       <div style="text-align: left; margin: 30px 0;">
         <a href="${detailUrl}" class="cta-button">View Ticket</a>
       </div>`,
      emailTheme,
    );

    return await this.mail.sendMail({
      from: 'MedVirtual <noreply@medvirtual.ai>',
      to: [creator.email],
      subject: `New note on your ticket: ${ticket.title}`,
      html,
    });
  }
}


