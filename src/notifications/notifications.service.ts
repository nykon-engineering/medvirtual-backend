import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { getUserEmailTheme } from '../common/utils/email-templates/theme-helper';
import { ticketTypeReverseDictionary } from '../common/dictionaries/ticket-type';
import { getEmailThemeByBusinessUnit } from '../common/utils/email-templates/theme';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) { }


  // Helper function to decode HTML entities
  private decodeHtmlEntities = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#x2f;/g, '/')
    .replace(/&#47;/g, '/');
};

  /**
   * 
   * Builds the correct ticket detail URL based on user role
   * Clients (organization admins) use /profile?ticket=, system admins use /tickets?ticket=
   */
  private getTicketDetailUrl(ticketId: string, userRole?: string): string {
    const isClient = userRole === 'organization_admin' || userRole === 'organization_super_admin';
    const path = isClient ? '/profile' : '/tickets';
    return `${process.env.FRONTEND_URL}${path}?ticket=${ticketId}`;
  }

  private async sendMailWithPrefix(options: { from: string; to: string | string[]; subject: string; html: string }): Promise<boolean> {
    const isProduction = process.env.ENVIRONMENT === 'PROD';
    const from = isProduction ? options.from : `[DEV] ${options.from}`;
    return this.mail.sendMail({ ...options, from });
  }

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

  async notifyHireRequestPlacementCompleted(hireRequestId: string): Promise<boolean> {
    const hr = await this.prisma.hireRequest.findUnique({
      where: { id: hireRequestId },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        salary_range_from: true,
        salary_range_to: true,
        expected_start_date: true,
        createdBy: {
          select: { id: true, email: true, first_name: true, last_name: true },
        },
        assign_user_id: true,
        assigned_sourcing: {
          select: { id: true, email: true, first_name: true, last_name: true },
        },
        organization: {
          select: { name: true, business_unit: true },
        },
        panels: {
          select: {
            id: true,
            panelCandidates: {
              where: { status: 'selected_by_client' }, //get all selected candidates since right now we can have mmore than one
              select: {
                candidate: {
                  select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                    name: true,
                    country: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!hr) throw new NotFoundException('Hire request not found');
    const userIds = hr?.assign_user_id?.split(',').map(id => id.trim()).filter(Boolean);
   
    // get all users to notify
    const users = await this.prisma.uSER.findMany({
      where: { id: { in: userIds } },
      select: { email: true, first_name: true, last_name: true, id: true },
    });
    
    if (!users || users.length === 0 || !users[0].email)
      throw new BadRequestException('Hire request has no assignee email');
    

    const detailUrl = `${process.env.FRONTEND_URL}/hire-requests?request=${hr.id}`;
    const salaryRange = hr.salary_range_from && hr.salary_range_to
      ? `$${hr.salary_range_from} - $${hr.salary_range_to}`
      : 'Not specified';
    const startDate = hr.expected_start_date
      ? new Date(hr.expected_start_date).toLocaleDateString()
      : 'Not specified';

    // Get winner candidate name
    const winners = hr.panels?.[0]?.panelCandidates.length > 0
      ?
      hr.panels?.[0].panelCandidates.map(pa =>
        `<p><div style='margin-left:3px; border-radius:8px; background-color:#CCC; padding:3px;'>
        <strong>${pa.candidate.name || `${pa.candidate.first_name || ''} ${pa.candidate.last_name || ''}`.trim()}</strong><br/>
        Location: <strong>${pa.candidate.country || 'Location not specified'}</strong>
        </div></p>`
      )
      .join('')
    : '';
    const emailTheme = getEmailThemeByBusinessUnit(hr.organization.business_unit);

    const recipients = [
      ...users.map(user => user.email),
      hr.assigned_sourcing?.email,
      hr.createdBy?.email,
    ].filter((email): email is string => Boolean(email));

    if (recipients.length === 0) {
      throw new BadRequestException('No valid recipient emails found');
    }

    const html = this.buildEmail(
      `<h2>Placement Completed</h2>
      <p>The hire request has been marked as <strong>placement completed</strong>.</p>
       
       <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
         <h3 style="margin-top: 0; color: #333;">Hire Request Details</h3>
         <p><strong>Title:</strong> ${hr.title}</p>
         <p><strong>Organization:</strong> ${hr.organization.name}</p>
         <p><strong>Description:</strong> 
         <span style="font-size: 0.875rem; line-height: 1.625; white-space: pre-wrap;">${hr.description || 'No description provided'}</span>
         </p>
         <p><strong>Salary Range:</strong> ${salaryRange}</p>
         <p><strong>Expected Start Date:</strong> ${startDate}</p>
         <p><strong>Selected Candidates:</strong> </p>
         ${winners}
       </div>
       
        <p>Please proceed with onboarding steps.</p>
        <div style="text-align: left; margin: 30px 0;">
          <a href="${detailUrl}" class="cta-button">
            View Hire Request Details
          </a>
        </div>`,
      emailTheme
    );

    return await this.sendMailWithPrefix({
      from: `${hr.organization.business_unit || 'MedVirtual'} <noreply@medvirtual.ai>`,
      to: recipients,
      subject: `Placement completed: ${hr.title}`,
      html,
    });
    
  }

  async notifyInterviewScheduled(hireRequestId: string): Promise<boolean> {
    const hr = await this.prisma.hireRequest.findUnique({
      where: { id: hireRequestId },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        salary_range_from: true,
        salary_range_to: true,
        expected_start_date: true,
        hubspot_role_type: true,
        availability: true,
        assign_user_id: true,
        organization: {
          select: { name: true, id: true, business_unit: true },
        },
        panels: {
          select: {
            id: true,
            interviews: {
              select: {
                id: true,
                scheduled_date: true,
                link: true,
              },
            },
            panelCandidates: {
              select: {
                candidate: {
                  select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!hr) throw new NotFoundException('Hire request not found');
    const userIds = hr?.assign_user_id?.split(',').map(id => id.trim()).filter(Boolean);
   
    // get all users to notify
    const users = await this.prisma.uSER.findMany({
      where: { id: { in: userIds } },
      select: { email: true, first_name: true, last_name: true, id: true },
    });
    if (!users || users.length === 0 || !users[0].email)
      throw new BadRequestException('Hire request has no assignee email');

    const startDate = hr.expected_start_date
      ? new Date(hr.expected_start_date).toLocaleDateString()
      : 'Not specified';

    // Get the link and date of the scheduled interview
    const interviewDate = hr.panels?.[0]?.interviews?.[0]?.scheduled_date
    const interviewLink = hr.panels?.[0]?.interviews?.[0]?.link || '#';
    const interviewDateFormatted = interviewDate
      ? new Date(interviewDate).toLocaleString()
      : 'Not specified';

    const bodyLine = interviewLink !== '#' ? `<p><strong>Pairing Link:</strong> <a href="${interviewLink}">${interviewLink}</a></p>` : '';
    const bodyLink = interviewLink !== '#' ? `<div style="text-align: left; margin: 30px 0;">
          <a href="${interviewLink}" class="cta-button">
            Join meeting
          </a>
        </div>` : '';

    //get all users from organization for send emails to them
    const emailsUsers = await this.prisma.uSER.findMany({
      where: {
        organization_id: hr.organization.id,
        status: 'active',
      },
      select: {
        email: true,
      },
    });


    const emailTheme = await getEmailThemeByBusinessUnit(hr.organization.business_unit);

    const html = this.buildEmail(
      `<p>You have been invited to an <strong>Interview</strong>.</p>
       
       <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
         <h3 style="margin-top: 0; color: #333;">Position Details</h3>
         <p><strong>Title:</strong> ${hr.title}</p>
         <p><strong>Company:</strong> ${hr.organization.name}</p>
         <p><strong>Expected Start Date:</strong> ${startDate}</p>
         <p><strong>Pairing Date:</strong> ${interviewDateFormatted}</p>
         ${bodyLine}
       </div>
       
       ${bodyLink}`,
      emailTheme
    );
    return await this.sendMailWithPrefix({
      from: `${emailTheme?.companyName || 'MedVirtual'} <noreply@medvirtual.ai>`,
      to: emailsUsers.map(u => u.email),
      subject: `Interview Invite: ${hr.hubspot_role_type} - ${hr.availability}`,
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
        assign_user_id: true,
        organization: {
          select: { name: true, business_unit: true },
        },
      },
    });
    if (!hr) throw new NotFoundException('Hire request not found');
    const userIds = hr?.assign_user_id?.split(',').map(id => id.trim()).filter(Boolean);

    // get all users to notify
    const users = await this.prisma.uSER.findMany({
      where: { id: { in: userIds } },
      select: { email: true, first_name: true, last_name: true, id: true },
    });
    if (!users || users.length === 0 || !users[0].email)
      throw new BadRequestException('Hire request has no assignee email');

    const verb = action === 'edited' ? 'edited' : 'canceled';
    const detailUrl = `${process.env.FRONTEND_URL}/hire-requests?request=${hr.id}`;

    const emailTheme = getEmailThemeByBusinessUnit(hr.organization.business_unit);

    const html = this.buildEmail(
      `<h2>Hire Request ${verb.toUpperCase()}</h2>
       <p>The hire request was ${verb} by the client.</p>
       
       <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
         <h3 style="margin-top: 0; color: #333;">Hire Request Details</h3>
         <p><strong>Title:</strong> ${hr.title}</p>
         <p><strong>Organization:</strong> ${hr.organization.name}</p>
         <p><strong>Description:</strong> 
         <span style="font-size: 0.875rem; line-height: 1.625; white-space: pre-wrap;">${hr.description || 'No description provided'}</span>
         </p>
       </div>
       
       <div style="text-align: left; margin: 30px 0;">
         <a href="${detailUrl}" class="cta-button">
           View Hire Request Details
         </a>
       </div>`,
      emailTheme
    );

    return await this.sendMailWithPrefix({
      from: `${hr.organization.business_unit || 'MedVirtual'} <noreply@medvirtual.ai>`,
      to: users.map(user => user.email),
      subject: `Hire Request ${verb}: ${hr.title}`,
      html,
    });
  }

  async notifyHireRequestSourcingAssignee(hireRequestId: string, action: 'sourcing'): Promise<boolean> {
    const hr = await this.prisma.hireRequest.findUnique({
      where: { id: hireRequestId },
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        assigned_sourcing: { select: { id: true, email: true, first_name: true, last_name: true } },
        organization: {
          select: { name: true, business_unit: true },
        },
      },
    });
    if (!hr) throw new NotFoundException('Hire request not found');
    if (!hr.assigned_sourcing?.email)
      throw new BadRequestException('Hire request has no assignee email');

    const verb = action;
    const detailUrl = `${process.env.FRONTEND_URL}/hire-requests?request=${hr.id}`;

    const emailTheme = getEmailThemeByBusinessUnit(hr.organization.business_unit);

    const html = this.buildEmail(
      `<p>${hr.assigned_sourcing.first_name ?? hr.assigned_sourcing.first_name} ${hr.assigned_sourcing.last_name ?? hr.assigned_sourcing.last_name}</p>
       <p>The hire request was updated to Start to sourcing stage.</p>
       
       <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
         <h3 style="margin-top: 0; color: #333;">Hire Request Details</h3>
         <p><strong>Title:</strong> ${hr.title}</p>
         <p><strong>Organization:</strong> ${hr.organization.name}</p>
         <p><strong>Description:</strong> 
         <span style="font-size: 0.875rem; line-height: 1.625; white-space: pre-wrap;">${hr.description || 'No description provided'}</span>
         </p>
       </div>
       
       <div style="text-align: left; margin: 30px 0;">
         <a href="${detailUrl}" class="cta-button">
           View Hire Request Details
         </a>
       </div>`,
      emailTheme
    );

    return await this.sendMailWithPrefix({
      from: `${hr.organization.business_unit || 'MedVirtual'} <noreply@medvirtual.ai>`,
      to: [hr.assigned_sourcing.email],
      subject: `Hire Request ${verb}: ${hr.title}`,
      html,
    });
  }

  async notifyHireRequestConciergeAssigned(hireRequestId: string, action: 'for_review'): Promise<boolean> {
    const hr = await this.prisma.hireRequest.findUnique({
      where: { id: hireRequestId },
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        assign_user_id: true,
        organization: {
          select: { name: true, business_unit: true },
        },
      },
    });
    if (!hr) throw new NotFoundException('Hire request not found');
    const userIds = hr?.assign_user_id?.split(',').map(id => id.trim()).filter(Boolean);

    // get all users to notify
    const users = await this.prisma.uSER.findMany({
      where: { id: { in: userIds } },
      select: { email: true, first_name: true, last_name: true, id: true },
    });
    if (!users || users.length === 0 || !users[0].email)
      throw new BadRequestException('Hire request has no assignee email');

    const verb = action === 'for_review' ? 'For Review' : action;
    const detailUrl = `${process.env.FRONTEND_URL}/hire-requests?request=${hr.id}`;

    const emailTheme = getEmailThemeByBusinessUnit(hr.organization.business_unit);

    const html = this.buildEmail(
      `<p>${users[0].first_name ?? users[0].first_name}</p>
       <p><strong>Hire Request Ready For Review</strong></p>
       <p>This request requires your attention:</p>
       
       <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
         <h3 style="margin-top: 0; color: #333;">Hire Request Details</h3>
         <p><strong>Title:</strong> ${hr.title}</p>
         <p><strong>Organization:</strong> ${hr.organization.name}</p>
         <p><strong>Description:</strong>
         <span style="font-size: 0.875rem; line-height: 1.625; white-space: pre-wrap;">${hr.description || 'No description provided'}</span>
         </p>
       </div>
       
       <div style="text-align: left; margin: 30px 0;">
         <a href="${detailUrl}" class="cta-button">
           View Hire Request Details
         </a>
       </div>`,
      emailTheme
    );

    return await this.sendMailWithPrefix({
      from: `${hr.organization.business_unit || 'MedVirtual'} <noreply@medvirtual.ai>`,
      to: users.map(user => user.email).filter(Boolean),
      subject: `Hire Request ${verb}: ${hr.title}`,
      html,
    });
  }

  async notifyHireRequestCreated(hireRequestId: string, type?: string, from?: string): Promise<boolean> {
    const hr = await this.prisma.hireRequest.findUnique({
      where: { id: hireRequestId },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        salary_range_from: true,
        salary_range_to: true,
        expected_start_date: true,
        availability: true,
        assign_user_id: true,
        assigned_sourcing: {
          select: { id: true, email: true, first_name: true, last_name: true },
        },
        assigned_staffing: {
          select: { id: true, email: true, first_name: true, last_name: true },
        },
        organization: {
          select: { name: true, business_unit: true },
        },
      },
    });
    if (!hr) throw new NotFoundException('Hire request not found');

    let userIds: string[] = [];
    if (type === 'sourcing') {
      if (!hr.assigned_sourcing?.email) throw new BadRequestException('Hire request has no assignee email');
      userIds = [hr.assigned_sourcing.id];
    } else if (type === 'staffing_coordinator') {
      if (!hr.assigned_staffing?.email) throw new BadRequestException('Hire request has no assignee email');
      userIds = [hr.assigned_staffing.id];
    } else {
      if (!hr.assign_user_id) throw new BadRequestException('Hire request has no assignee');
      userIds = hr.assign_user_id.split(',').map(id => id.trim()).filter(Boolean);
    }
    if (userIds.length === 0) throw new BadRequestException('No valid user IDs to notify');

    // get all users to notify
    const users = await this.prisma.uSER.findMany({
      where: { id: { in: userIds } },
      select: { email: true, first_name: true, last_name: true, id: true },
    });
    const emails = users.map(u => u.email).filter(Boolean);
    if (emails.length === 0) throw new BadRequestException('No assignee emails found');

    const detailUrl = `${process.env.FRONTEND_URL}/hire-requests?request=${hr.id}`;
    const salaryRange = hr.salary_range_from && hr.salary_range_to
      ? `$${hr.salary_range_from} - $${hr.salary_range_to}`
      : 'Not specified';
    const startDate = hr.expected_start_date
      ? new Date(hr.expected_start_date).toLocaleDateString()
      : 'Not specified';

    const emailTheme = getEmailThemeByBusinessUnit(hr.organization.business_unit);

    const html = this.buildEmail(
      `<p>${users.map(u => `${u.first_name || ''} ${u.last_name || ''}`).join(', ')}</p>
      ${type === 'sourcing' ? `<p><strong>Sourcing Assignment to a Hire Request</strong></p>` : type === 'staffing_coordinator' ? `<p><strong>Staffing Coordinator Assignment to a Hire Request</strong></p>` : `<p><strong>Assignment to a Hire Request</strong></p>`}
       <p>You have been assigned ${type === 'sourcing' ? `to source` : type === 'staffing_coordinator' ? `as a staffing coordinator` : `to`} this hire request:</p>
       
       <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
         <h3 style="margin-top: 0; color: #333;">Hire Request Details</h3>
         <p><strong>Title:</strong> ${hr.title}</p>
         <p><strong>Organization:</strong> ${hr.organization.name}</p>
         <p><strong>Description:</strong>
         <span style="font-size: 0.875rem; line-height: 1.625; white-space: pre-wrap;">${hr.description || 'No description provided'}</span>
         </p>
         <p><strong>Availability:</strong> ${hr.availability}</p>

         <p><strong>Salary Range:</strong> ${salaryRange}</p>
         <p><strong>Expected Start Date:</strong> ${startDate}</p>
         <p><strong>Status:</strong> ${hr.status}</p>
       </div>
       
       <p>Please review the details and take appropriate action.</p>
       <div style="text-align: left; margin: 30px 0;">
         <a href="${detailUrl}" class="cta-button">
           View Hire Request Details
         </a>
       </div>
       ${from === 'panel_request_flow' ? `<p>This hire request was created from Panel Request Flow.</p>` : ''}`,
      emailTheme
    );

    return await this.sendMailWithPrefix({
      from: `${hr.organization.business_unit || 'MedVirtual'} <noreply@medvirtual.ai>`,
      to: emails,
      subject: `Hire Request Assigned: ${hr.title}`,
      html,
    });
  }

  async notifyHireRequestBackToSourcing(hireRequestId: string): Promise<boolean> {
    const hr = await this.prisma.hireRequest.findUnique({
      where: { id: hireRequestId },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        salary_range_from: true,
        salary_range_to: true,
        expected_start_date: true,
        availability: true,
        assign_user_id: true,
        assigned_sourcing: {
          select: { id: true, email: true, first_name: true, last_name: true },
        },
        organization: {
          select: { name: true, business_unit: true },
        },
      },
    });
    if (!hr) throw new NotFoundException('Hire request not found');
    let destin = hr.assigned_sourcing;
    
    if (!destin?.email)
      throw new BadRequestException('Hire request has no assignee email');

    const detailUrl = `${process.env.FRONTEND_URL}/hire-requests?request=${hr.id}`;
    const salaryRange = hr.salary_range_from && hr.salary_range_to
      ? `$${hr.salary_range_from} - $${hr.salary_range_to}`
      : 'Not specified';
    const startDate = hr.expected_start_date
      ? new Date(hr.expected_start_date).toLocaleDateString()
      : 'Not specified';

    const emailTheme = getEmailThemeByBusinessUnit(hr.organization.business_unit);

    const html = this.buildEmail(
      `<p>${destin.first_name && destin.first_name} ${destin.last_name && destin.last_name}</p>
       <p><strong>Back to sourcing</strong></p>
       <p>A hire request requires your attention since it has been put back to sourcing:</p>
       
       <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
         <h3 style="margin-top: 0; color: #333;">Hire Request Details</h3>
         <p><strong>Title:</strong> ${hr.title}</p>
         <p><strong>Organization:</strong> ${hr.organization.name}</p>
         <p><strong>Description:</strong> 
         <span style="font-size: 0.875rem; line-height: 1.625; white-space: pre-wrap;">${hr.description || 'No description provided'}</span>
         </p>
         <p><strong>Availability:</strong> ${hr.availability}</p>

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

    return await this.sendMailWithPrefix({
      from: `${hr.organization.business_unit || 'MedVirtual'} <noreply@medvirtual.ai>`,
      to: [destin.email],
      subject: `Hire Request Assigned: ${hr.title}`,
      html,
    });
  }

  async notifyClientPanelReady(hireRequestId: string): Promise<boolean> {
    const hr = await this.prisma.hireRequest.findUnique({
      where: { id: hireRequestId },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        salary_range_from: true,
        salary_range_to: true,
        expected_start_date: true,
        availability: true,
        organization: {
          select: {
            id: true,
            name: true,
            business_unit: true,
          },
        },
      },
    });
    if (!hr) throw new NotFoundException('Hire request not found');

    const orgUsers = await this.prisma.uSER.findMany({
      where: {
        organization_id: hr.organization.id,
        status: 'active',
      },
      select: { email: true },
    });

    const emails = orgUsers.map(u => u.email).filter(Boolean);
    if (emails.length === 0) throw new BadRequestException('No active organization users found to notify');

    const detailUrl = `${process.env.FRONTEND_URL}/hire-requests?request=${hr.id}`;
    const salaryRange = hr.salary_range_from && hr.salary_range_to
      ? `$${hr.salary_range_from} - $${hr.salary_range_to}`
      : 'Not specified';
    const startDate = hr.expected_start_date
      ? new Date(hr.expected_start_date).toLocaleDateString()
      : 'Not specified';

    const emailTheme = getEmailThemeByBusinessUnit(hr.organization.business_unit);

    const html = this.buildEmail(
      `<p><strong>Your candidate panel is ready for review!</strong></p>
       <p>The panel for the following hire request has been reviewed and is now ready for your follow-up:</p>

       <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
         <h3 style="margin-top: 0; color: #333;">Hire Request Details</h3>
         <p><strong>Title:</strong> ${hr.title}</p>
         <p><strong>Organization:</strong> ${hr.organization.name}</p>
         <p><strong>Description:</strong>
         <span style="font-size: 0.875rem; line-height: 1.625; white-space: pre-wrap;">${hr.description || 'No description provided'}</span>
         </p>
         <p><strong>Availability:</strong> ${hr.availability}</p>
         <p><strong>Salary Range:</strong> ${salaryRange}</p>
         <p><strong>Expected Start Date:</strong> ${startDate}</p>
       </div>

       <p>Please review the details and candidates within this panel.</p>
       <div style="text-align: left; margin: 30px 0;">
         <a href="${detailUrl}" class="cta-button">
           View Candidates
         </a>
       </div>`,
      emailTheme
    );

    return await this.sendMailWithPrefix({
      from: `${hr.organization.business_unit || 'MedVirtual'} <noreply@medvirtual.ai>`,
      to: emails,
      subject: `Your candidate panel is ready: ${hr.title}`,
      html,
    });
  }

  async notifyHireRequestPanelReady(hireRequestId: string,): Promise<boolean> {
    const hr = await this.prisma.hireRequest.findUnique({
      where: { id: hireRequestId },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        salary_range_from: true,
        salary_range_to: true,
        expected_start_date: true,
        availability: true,
        assign_user_id: true,
        assigned_sourcing: {
          select: { id: true, email: true, first_name: true, last_name: true },
        },
        organization: {
          select: { 
            name: true,
            business_unit: true,
           },
        },
      },
    });
    if (!hr) throw new NotFoundException('Hire request not found');
    let destin=hr.assigned_sourcing;
    
    if (!destin?.email)
      throw new BadRequestException('Hire request has no assignee email');

    const detailUrl = `${process.env.FRONTEND_URL}/hire-requests?request=${hr.id}`;
    const salaryRange = hr.salary_range_from && hr.salary_range_to
      ? `$${hr.salary_range_from} - $${hr.salary_range_to}`
      : 'Not specified';
    const startDate = hr.expected_start_date
      ? new Date(hr.expected_start_date).toLocaleDateString()
      : 'Not specified';

    // Get email theme by organization business unit
    const emailTheme = getEmailThemeByBusinessUnit(hr.organization.business_unit);

    const html = this.buildEmail(
      `<p>${destin.first_name && destin.first_name} ${destin.last_name && destin.last_name}</p>
       <p><strong>Panel Ready</strong></p>
       <p>The panel of the following hire request has been reviewed and now it is ready:</p>
       
       <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
         <h3 style="margin-top: 0; color: #333;">Hire Request Details</h3>
         <p><strong>Title:</strong> ${hr.title}</p>
         <p><strong>Organization:</strong> ${hr.organization.name}</p>
         <p><strong>Description:</strong>
         <span style="font-size: 0.875rem; line-height: 1.625; white-space: pre-wrap;">${hr.description || 'No description provided'}</span>
         </p>
         <p><strong>Availability:</strong> ${hr.availability}</p>
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

    return await this.sendMailWithPrefix({
      from: `${hr.organization?.business_unit || 'MedVirtual'} <noreply@medvirtual.ai>`,
      to: [destin.email],
      subject: `Panel Reviewed and Ready: ${hr.title}`,
      html,
    });
  }

  async notifyEndorseCandidates(hireRequestId: string): Promise<boolean> {
    const hr = await this.prisma.hireRequest.findUnique({
      where: { id: hireRequestId },
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        assign_user_id: true,
        organization: {
          select: { name: true, business_unit: true },
        },
      },
    });
    if (!hr) throw new NotFoundException('Hire request not found');
    const userIds = hr?.assign_user_id?.split(',').map(id => id.trim()).filter(Boolean);

    // get all users to notify
    const users = await this.prisma.uSER.findMany({
      where: { id: { in: userIds } },
      select: { email: true, first_name: true, last_name: true, id: true },
    });
    if (!users || users.length === 0 || !users[0].email)
      throw new BadRequestException('Hire request has no assignee email');

    const detailUrl = `${process.env.FRONTEND_URL}/hire-requests?request=${hr.id}`;

    const emailTheme = getEmailThemeByBusinessUnit(hr.organization.business_unit);

    const html = this.buildEmail(
      `<p>${users[0].first_name ?? users[0].first_name} ${users[0].last_name ?? users[0].last_name}</p>
       <p>The hire request received new candidates.</p>
       
       <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
         <h3 style="margin-top: 0; color: #333;">Hire Request Details</h3>
         <p><strong>Title:</strong> ${hr.title}</p>
         <p><strong>Organization:</strong> ${hr.organization.name}</p>
         <p><strong>Description:</strong> 
         <span style="font-size: 0.875rem; line-height: 1.625; white-space: pre-wrap;">${hr.description || 'No description provided'}</span>
         </p>
       </div>
       
       <div style="text-align: left; margin: 30px 0;">
         <a href="${detailUrl}" class="cta-button">
           View Hire Request Details
         </a>
       </div>`,
      emailTheme
    );

    return await this.sendMailWithPrefix({
      from: `${hr.organization.business_unit || 'MedVirtual'} <noreply@medvirtual.ai>`,
      to: users.map(user => user.email),
      subject: `New candidates in Hire Request: ${hr.title}`,
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
        salary_range_from: true,
        salary_range_to: true,
        expected_start_date: true,
        hubspot_role_type: true,
        availability: true,
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

    const emailTheme = getEmailThemeByBusinessUnit(hr.organization.business_unit);

    const html = this.buildEmail(
      `<p>Your hire request has been completed.</p>
       
       <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
         <h3 style="margin-top: 0; color: #333;">Hire Request Details</h3>
         <p><strong>Title:</strong> ${hr.title}</p>
         <p><strong>Organization:</strong> ${hr.organization.name}</p>
         <p><strong>Description:</strong>
         <span style="font-size: 0.875rem; line-height: 1.625; white-space: pre-wrap;">${hr.description || 'No description provided'}</span>
         </p>
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
    const results = this.sendMailWithPrefix({
      from: `${hr.organization.business_unit || 'MedVirtual'} <noreply@medvirtual.ai>`,
      to: uniqueRecipients.map(r => r.email),
      subject: `Hire Request Completed: ${hr.hubspot_role_type} - ${hr.availability}.`,
      html,
    });

    // Return true if at least one email was sent successfully
    return results;
  }

  async notifyHireRequestAwaitingDecision(hireRequestId: string): Promise<boolean> {
    const hr = await this.prisma.hireRequest.findUnique({
      where: { id: hireRequestId },
      select: {
        id: true,
        title: true,
        hubspot_role_type: true,
        availability: true,
        status: true,
        panels: {
          where: {
            status: 'decision_pending',
          },
          select: {
            id: true,
            status: true,
            scheduled_date: true,
          },
          take: 1,
        },
        organization: {
          select: {
            id: true,
            name: true,
            business_unit: true,
          },
        },
      },
    });

    if (!hr) throw new NotFoundException('Hire request not found');

    // Get organization admin and super admin users (clients)
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

    // Remove duplicates by email
    const uniqueRecipients = organizationAdmins.filter((recipient, index, self) =>
      index === self.findIndex(r => r.email === recipient.email)
    );

    if (uniqueRecipients.length === 0) {
      throw new BadRequestException('No organization admins found to notify');
    }

    //removed on 2025-11-13 asked by Pauli on medvirtual group
    //const detailUrl = `${process.env.FRONTEND_URL}/hire-requests?request=${hr.id}`;
    const detailUrl = `${process.env.FRONTEND_URL}/interview-panels`;

    // Get panel information
    const panel = hr.panels?.[0];
    const scheduledDate = panel?.scheduled_date
      ? new Date(panel.scheduled_date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Not specified';

    const emailTheme = getEmailThemeByBusinessUnit(hr.organization.business_unit);

    const html = this.buildEmail(
      `<p>Your hire request has been marked as <strong>awaiting decision</strong>.</p>
      
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p><strong>Scheduled Date:</strong> ${scheduledDate}</p>
      </div>
      
      <div style="text-align: left; margin: 30px 0;">
        <a href="${detailUrl}" class="cta-button">
          Review Hire Request
        </a>
      </div>`,
      emailTheme
    );
    const results = this.sendMailWithPrefix({
      from: `${hr.organization.business_unit || 'MedVirtual'} <noreply@medvirtual.ai>`,
      to: uniqueRecipients.map(r => r.email),
      subject: `Your hire request has been marked as awaiting decision: ${hr.hubspot_role_type} - ${hr.availability}`,
      html,
    });

    // Return true if at least one email was sent successfully
    return results;
  }
  // ======== Tickets ========

  async notifyTicketStatusChangeToCreator(ticket: any, newStatus: 'in_progress' | 'resolved' | 'closed'): Promise<boolean> {
    if (!ticket) throw new NotFoundException('Ticket not found');

    // Only notify the creator
    let creatorEmail: string | undefined;
    let emailThemeUserId: string | undefined;
    let creatorRole: string | undefined;

    if (ticket.created_by) {
      const creator = await this.prisma.uSER.findUnique({
        where: { id: ticket.created_by },
        select: { id: true, email: true, role: true },
      });
      if (creator?.email) {
        creatorEmail = creator.email;
        emailThemeUserId = creator.id;
        creatorRole = creator.role;
      }
    } else if (ticket.id) {
      // Fallback to fetch created_by
      const withCreator = await this.prisma.ticket.findUnique({
        where: { id: ticket.id },
        select: { created_by: true },
      });
      if (withCreator?.created_by) {
        const creator = await this.prisma.uSER.findUnique({
          where: { id: withCreator.created_by },
          select: { id: true, email: true, role: true },
        });
        if (creator?.email) {
          creatorEmail = creator.email;
          emailThemeUserId = creator.id;
          creatorRole = creator.role;
        }
      }
    }

    if (!creatorEmail) throw new BadRequestException('Ticket creator has no email');

    // Filter: Only send to clients (organization admins) if ticket type is "Support"
    // System admins always receive notifications for all ticket types
    const isSystemAdmin = creatorRole === 'system_admin' || creatorRole === 'system_super_admin';
    const isClient = !isSystemAdmin; // Organization admins are considered clients
    const ticketType = ticket.type?.toLowerCase();
    const isSupportTicket = ticketType === 'support';

    // Skip notification if creator is a client and ticket is not a Support ticket
    if (isClient && !isSupportTicket) {
      return false; // Don't send notification to clients for non-Support tickets
    }

    const detailUrl = this.getTicketDetailUrl(ticket.id, creatorRole);
    const createdDate = new Date(ticket.createdAt).toLocaleDateString();

    // Get user email theme
    const emailTheme = emailThemeUserId ? await getUserEmailTheme(this.prisma, emailThemeUserId) : null;

    // Format status for display
    const statusDisplay = newStatus.replace('_', ' ').toUpperCase();

    // Check if ticket type is Referral to use "Candidate Details" instead of "Description"
    const isReferralTicket = ticket.type?.toLowerCase() === 'referral';
    const descriptionLabel = isReferralTicket ? 'Candidate Details' : 'Description';

    // Parse Referral ticket description format
    let descriptionContent = '';
    if (isReferralTicket && ticket.description) {
      descriptionContent = this.formatReferralDescription(ticket.description);
    }

    const html = this.buildEmail(
      `
       <p>Your ticket has been updated to <strong>${statusDisplay}</strong> status.</p>
       <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
         <h3 style="margin-top: 0; color: #333;">Ticket Details</h3>
         <p><strong>Title:</strong> ${ticket.title}</p>
         <p><strong>Organization:</strong> ${ticket.organization?.name || 'N/A'}</p>
         ${isReferralTicket ? '' : `<p><strong>${descriptionLabel}:</strong> <br>${this.formatDescription(ticket.description)}</p>`}
         <p><strong>Type:</strong> ${ticket.type}</p>
         <p><strong>Status:</strong> ${statusDisplay}</p>
         <p><strong>Created:</strong> ${createdDate}</p>
       </div>
       ${isReferralTicket ? descriptionContent : ''}
       
       <div style="text-align: left; margin: 30px 0;">
         <a href="${detailUrl}" class="cta-button">
           View Ticket Details
         </a>
       </div>
       <div style="margin-top: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 5px; font-size: 12px; color: #666;">
         <p style="margin: 0 0 5px 0;"><strong>Or copy this link:</strong></p>
         <a href="${detailUrl}" style="color: #01546B; word-break: break-all; text-decoration: none;">${detailUrl}</a>
       </div>`,
      emailTheme
    );

    return await this.sendMailWithPrefix({
      from: `${emailTheme?.companyName || 'MedVirtual'} <noreply@medvirtual.ai>`,
      to: [creatorEmail],
      subject: `Your ticket changed to ${statusDisplay} status: ${ticket.title}`,
      html,
    });
  }

  async notifyTicketReopened(ticket: any): Promise<boolean> {
    if (!ticket) throw new NotFoundException('Ticket not found');

    // Only notify the creator
    let creatorEmail: string | undefined;
    let emailThemeUserId: string | undefined;
    let creatorRole: string | undefined;

    if (ticket.created_by) {
      const creator = await this.prisma.uSER.findUnique({
        where: { id: ticket.created_by },
        select: { id: true, email: true, role: true },
      });
      if (creator?.email) {
        creatorEmail = creator.email;
        emailThemeUserId = creator.id;
        creatorRole = creator.role;
      }
    } else if (ticket.id) {
      // Fallback to fetch created_by
      const withCreator = await this.prisma.ticket.findUnique({
        where: { id: ticket.id },
        select: { created_by: true },
      });
      if (withCreator?.created_by) {
        const creator = await this.prisma.uSER.findUnique({
          where: { id: withCreator.created_by },
          select: { id: true, email: true, role: true },
        });
        if (creator?.email) {
          creatorEmail = creator.email;
          emailThemeUserId = creator.id;
          creatorRole = creator.role;
        }
      }
    }

    if (!creatorEmail) throw new BadRequestException('Ticket creator has no email');

    // Filter: Only send to clients (organization admins) if ticket type is "Support"
    // System admins always receive notifications for all ticket types
    const isSystemAdmin = creatorRole === 'system_admin' || creatorRole === 'system_super_admin';
    const isClient = !isSystemAdmin; // Organization admins are considered clients
    const ticketType = ticket.type?.toLowerCase();
    const isSupportTicket = ticketType === 'support';

    // Skip notification if creator is a client and ticket is not a Support ticket
    if (isClient && !isSupportTicket) {
      return false; // Don't send notification to clients for non-Support tickets
    }

    const detailUrl = this.getTicketDetailUrl(ticket.id, creatorRole);
    const createdDate = new Date(ticket.createdAt).toLocaleDateString();

    // Get user email theme
    const emailTheme = emailThemeUserId ? await getUserEmailTheme(this.prisma, emailThemeUserId) : null;

    // Check if ticket type is Referral to use "Candidate Details" instead of "Description"
    const isReferralTicket = ticket.type?.toLowerCase() === 'referral';
    const descriptionLabel = isReferralTicket ? 'Candidate Details' : 'Description';

    // Parse Referral ticket description format
    let descriptionContent = '';
    if (isReferralTicket && ticket.description) {
      descriptionContent = this.formatReferralDescription(ticket.description);
    }

    const html = this.buildEmail(
      `
       <p>Your ticket has been <strong>reopened</strong> and is now back to <strong>NEW</strong> status.</p>
       <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
         <h3 style="margin-top: 0; color: #333;">Ticket Details</h3>
         <p><strong>Title:</strong> ${ticket.title}</p>
         <p><strong>Organization:</strong> ${ticket.organization?.name || 'N/A'}</p>
         ${isReferralTicket ? '' : `<p><strong>${descriptionLabel}:</strong> <br>${this.formatDescription(ticket.description)}</p>`}
         <p><strong>Type:</strong> ${ticket.type}</p>
         <p><strong>Status:</strong> NEW</p>
         <p><strong>Created:</strong> ${createdDate}</p>
       </div>
       ${isReferralTicket ? descriptionContent : ''}
       
       <div style="text-align: left; margin: 30px 0;">
         <a href="${detailUrl}" class="cta-button">
           View Ticket Details
         </a>
       </div>
       <div style="margin-top: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 5px; font-size: 12px; color: #666;">
         <p style="margin: 0 0 5px 0;"><strong>Or copy this link:</strong></p>
         <a href="${detailUrl}" style="color: #01546B; word-break: break-all; text-decoration: none;">${detailUrl}</a>
       </div>`,
      emailTheme
    );

    return await this.sendMailWithPrefix({
      from: `${emailTheme?.companyName || 'MedVirtual'} <noreply@medvirtual.ai>`,
      to: [creatorEmail],
      subject: `Your ticket has been reopened: ${ticket.title}`,
      html,
    });
  }

  async notifyTicketEvent(ticket: any, event: 'created' | 'assigned' | 'updated' | 'resolved' | 'closed'): Promise<boolean> {

    if (!ticket) throw new NotFoundException('Ticket not found');

    // Get ticket type early to check if it's Support
    const ticketType = ticket.type?.toLowerCase();
    const isSupportTicket = ticketType === 'support';

    // Get created_by ID (from ticket object or fetch if needed)
    let createdById: string | null = null;
    if (ticket.created_by) {
      createdById = ticket.created_by;
    } else if (ticket.id) {
      const ticketData = await this.prisma.ticket.findUnique({
        where: { id: ticket.id },
        select: { created_by: true, user_id: true },
      });
      createdById = ticketData?.created_by || null;
      // Also update ticket.user_id if not available in ticket object
      if (!ticket.user_id && ticketData?.user_id) {
        ticket.user_id = ticketData.user_id;
      }
    }

    // Get assigned user ID
    const assignedUserId = ticket.user?.id || ticket.user_id;

    // Check if creator and assignee are the same user - if so, don't send notification
    if (createdById && assignedUserId && createdById === assignedUserId) {
      // Creator and assignee are the same, skip notification
      return false;
    }

    // Determine recipients: include creator (requested) and keep assignee if present
    const recipients: { email: string; isSystemAdmin: boolean }[] = [];

    // Creator - only add if ticket is Support OR creator is system admin
    let emailThemeUserId: string | undefined = undefined;
    if (ticket.created_by) {
      const creator = await this.prisma.uSER.findUnique({
        where: { id: ticket.created_by },
        select: { id: true, email: true, role: true },
      });
      if (creator?.email) {
        const isSystemAdmin = creator.role === 'system_admin' || creator.role === 'system_super_admin';
        // Only add creator if ticket is Support OR creator is system admin
        if (isSupportTicket || isSystemAdmin) {
          recipients.push({ email: creator.email, isSystemAdmin });
          emailThemeUserId = emailThemeUserId || creator.id;
        }
      }
    } else if (ticket.id) {
      // Fallback to fetch created_by
      const withCreator = await this.prisma.ticket.findUnique({
        where: { id: ticket.id },
        select: { created_by: true },
      });
      if (withCreator?.created_by) {
        const creator = await this.prisma.uSER.findUnique({
          where: { id: withCreator.created_by },
          select: { id: true, email: true, role: true },
        });
        if (creator?.email) {
          const isSystemAdmin = creator.role === 'system_admin' || creator.role === 'system_super_admin';
          // Only add creator if ticket is Support OR creator is system admin
          if (isSupportTicket || isSystemAdmin) {
            recipients.push({ email: creator.email, isSystemAdmin });
            emailThemeUserId = emailThemeUserId || creator.id;
          }
        }
      }
    }

    // Assignee (kept for backwards compatibility)
    // Only add assignee if it's different from creator
    if (ticket.user?.email && (!createdById || ticket.user.id !== createdById)) {
      const isSystemAdmin = ticket.user.role === 'system_admin' || ticket.user.role === 'system_super_admin';
      recipients.push({ email: ticket.user.email, isSystemAdmin });
      emailThemeUserId = emailThemeUserId || ticket.user.id;
    }

    // Remove duplicates but keep system admin flag
    const uniqueRecipients = recipients.filter((recipient, index, self) =>
      index === self.findIndex(r => r.email === recipient.email)
    );

    // Filter: For status change events (resolved, closed), only send to clients if ticket type is "Support"
    // System admins always receive notifications for all ticket types
    // Note: 'in_progress' status changes are handled by notifyTicketStatusChangeToCreator
    const isStatusChangeEvent = event === 'resolved' || event === 'closed';

    let filteredRecipients = uniqueRecipients;
    if (isStatusChangeEvent && !isSupportTicket) {
      // Filter out client recipients (non-system-admins) for non-Support ticket status changes
      filteredRecipients = uniqueRecipients.filter(recipient => recipient.isSystemAdmin);
    }

    // Always notify fixed email for Support tickets
    if (isSupportTicket && !filteredRecipients.some(r => r.email === 'pauli@regenta.ai')) {
      filteredRecipients = [...filteredRecipients, { email: 'pauli@regenta.ai', isSystemAdmin: true }];
    }

    if (filteredRecipients.length === 0) throw new BadRequestException('Ticket has no recipient email');

    const createdDate = new Date(ticket.createdAt).toLocaleDateString();

    // Get user email theme (based on creator or assignee, in that order)
    const emailTheme = emailThemeUserId ? await getUserEmailTheme(this.prisma, emailThemeUserId) : null;

    // Get ticket type display name
    const ticketTypeDisplay = ticketTypeReverseDictionary[ticket.type] || ticket.type;

    // Check if ticket type is Referral to use "Candidate Details" instead of "Description"
    const isReferralTicket = ticket.type?.toLowerCase() === 'referral';
    const descriptionLabel = isReferralTicket ? 'Candidate Details' : 'Description';

    // Build staff member name (only name, no email)
    const staffName = ticket.staff?.candidate?.name?.trim() || null;

    // Build candidate name if available
    const candidateName = ticket.candidate?.name?.trim() ||
      (ticket.candidate?.first_name && ticket.candidate?.last_name
        ? `${ticket.candidate.first_name} ${ticket.candidate.last_name}`.trim()
        : null);

    // Send emails to each recipient with appropriate formatting
    const emailPromises = filteredRecipients.map(async (recipient) => {
      const isSystemAdmin = recipient.isSystemAdmin;
      
      // Get recipient role to build correct URL
      const recipientUser = await this.prisma.uSER.findUnique({
        where: { email: recipient.email },
        select: { role: true },
      });
      const recipientRole = recipientUser?.role;
      const detailUrl = this.getTicketDetailUrl(ticket.id, recipientRole);

      // Parse Referral ticket description format
      let descriptionContent = '';
      if (isReferralTicket && ticket.description) {
        descriptionContent = this.formatReferralDescription(ticket.description);
      }

      // For system admins and "created" event, use enhanced format
      if (isSystemAdmin && event === 'created') {
        // Build descriptive title based on ticket type
        let emailTitle = '';
        let emailSubject = '';

        if (ticketTypeDisplay === 'Bonus' && staffName && ticket.organization?.name) {
          emailTitle = `Bonus Ticket Created for ${ticket.organization.name}`;
          emailSubject = `Bonus Ticket Created for ${ticket.organization.name}`;
        } else if (ticketTypeDisplay === 'Bonus' && staffName) {
          emailTitle = `Bonus Ticket Created for ${staffName}`;
          emailSubject = `Bonus Ticket Created for ${staffName}`;
        } else if (ticket.organization?.name) {
          emailTitle = `${ticketTypeDisplay} Ticket Created for ${ticket.organization.name}`;
          emailSubject = `${ticketTypeDisplay} Ticket Created for ${ticket.organization.name}`;
        } else {
          emailTitle = `${ticketTypeDisplay} Ticket Created`;
          emailSubject = `${ticketTypeDisplay} Ticket Created`;
        }

        // Build type badge
        const typeBadge = `<span style="display: inline-block; background-color: #01546B; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-bottom: 10px;">${ticketTypeDisplay}</span>`;

        // Build staff info if available (only name)
        let staffInfo = '';
        if (staffName) {
          staffInfo = `<p><strong>Staff Member:</strong> ${staffName}</p>`;
        }

        // Build candidate info if available
        let candidateInfo = '';
        if (candidateName) {
          candidateInfo = `<p><strong>Candidate:</strong> ${candidateName}</p>`;
        }

        const html = this.buildEmail(
          `<h2>${emailTitle}</h2>
           <div style="margin-bottom: 20px;">
             ${typeBadge}
           </div>
           
           <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
             <h3 style="margin-top: 0; color: #333;">Ticket Details</h3>
             <p><strong>Title:</strong> ${ticket.title}</p>
             ${isReferralTicket ? '' : `<p><strong>${descriptionLabel}:</strong> ${this.formatDescription(ticket.description)}</p>`}
             <p><strong>Organization:</strong> ${ticket.organization?.name || 'N/A'}</p>
             ${staffInfo}
             ${candidateInfo}
           </div>
           ${isReferralTicket ? descriptionContent : ''}
           
           <div style="text-align: left; margin: 30px 0;">
             <a href="${detailUrl}" class="cta-button">
               View Ticket Details
             </a>
           </div>
           <div style="margin-top: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 5px; font-size: 12px; color: #666;">
             <p style="margin: 0 0 5px 0;"><strong>Or copy this link:</strong></p>
             <a href="${detailUrl}" style="color: #01546B; word-break: break-all; text-decoration: none;">${detailUrl}</a>
           </div>`,
          emailTheme
        );

        return this.sendMailWithPrefix({
          from: `${isSystemAdmin ? 'MedVirtual' : (emailTheme?.companyName || 'MedVirtual')} <noreply@medvirtual.ai>`,
          to: [recipient.email],
          subject: emailSubject,
          html,
        });
      } else {
        // Standard format for non-system admins or other events
        // Build staff member details if available (without email)
        let staffDetails = '';
        if (staffName) {
          staffDetails = `<p><strong>Staff Member:</strong> ${staffName}</p>`;
        }

        // Build candidate details if available
        let candidateDetails = '';
        if (candidateName) {
          candidateDetails = `<p><strong>Candidate:</strong> ${candidateName}</p>`;
        }

        const html = this.buildEmail(
          `<p>The ticket was <strong>${event}</strong>.</p>
           
           <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
             <h3 style="margin-top: 0; color: #333;">Ticket Details</h3>
             <p><strong>Title:</strong> ${ticket.title}</p>
             <p><strong>Organization:</strong> ${ticket.organization?.name || 'N/A'}</p>
             ${isReferralTicket ? '' : `<p><strong>${descriptionLabel}:</strong> ${this.formatDescription(this.decodeHtmlEntities(ticket.description))}</p>`}
             <p><strong>Type:</strong> ${ticketTypeDisplay}</p>
             ${staffDetails}${candidateDetails}
           </div>
           ${isReferralTicket ? descriptionContent : ''}
           
           <div style="text-align: left; margin: 30px 0;">
             <a href="${detailUrl}" class="cta-button">
               View Ticket Details
             </a>
           </div>
           <div style="margin-top: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 5px; font-size: 12px; color: #666;">
             <p style="margin: 0 0 5px 0;"><strong>Or copy this link:</strong></p>
             <a href="${detailUrl}" style="color: #01546B; word-break: break-all; text-decoration: none;">${detailUrl}</a>
           </div>`,
          emailTheme
        );

        return this.sendMailWithPrefix({
          from: `${isSystemAdmin ? 'MedVirtual' : (emailTheme?.companyName || 'MedVirtual')} <noreply@medvirtual.ai>`,
          to: [recipient.email],
          subject: `Ticket ${event}: ${ticket.title}`,
          html,
        });
      }
    });

    // Wait for all emails to be sent
    const results = await Promise.all(emailPromises);

    // Return true if at least one email was sent successfully
    return results.some(result => result === true);
  }



  async notifyTicketNoteAddedToAssignee(ticketId: string, note: { content: string; author?: { id?: string; first_name?: string; last_name?: string; email?: string } }): Promise<boolean> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        title: true,
        organization: { select: { name: true } },
        user_id: true,
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    if (!ticket.user_id || !ticket.user?.email) {
      throw new BadRequestException('Ticket has no assigned user with email');
    }

    // Get user role to build correct URL
    const assigneeUser = await this.prisma.uSER.findUnique({
      where: { id: ticket.user.id },
      select: { role: true },
    });
    const detailUrl = this.getTicketDetailUrl(ticket.id, assigneeUser?.role);

    const emailTheme = await getUserEmailTheme(this.prisma, ticket.user.id);

    const authorName = `${note.author?.first_name ?? ''} ${note.author?.last_name ?? ''}`.trim() || 'A user';

    const html = this.buildEmail(
      `<h2>You Received a Response on Your Ticket</h2>
       <p>You received a response on your ticket from <strong>${authorName}</strong>.</p>
       <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
         <h3 style="margin-top: 0; color: #333;">Ticket</h3>
         <p><strong>Title:</strong> ${ticket.title}</p>
         <p><strong>Organization:</strong> ${ticket.organization?.name || 'N/A'}</p>
       </div>
       <div style="background-color: #fff; border: 1px solid #eee; padding: 15px; border-radius: 8px;">
         <h3 style="margin-top: 0; color: #333;">Response</h3>
         <p style="white-space: pre-wrap;">${note.content}</p>
       </div>
       <div style="text-align: left; margin: 30px 0;">
         <a href="${detailUrl}" class="cta-button">View Ticket</a>
       </div>
       <div style="margin-top: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 5px; font-size: 12px; color: #666;">
         <p style="margin: 0 0 5px 0;"><strong>Or copy this link:</strong></p>
         <a href="${detailUrl}" style="color: #01546B; word-break: break-all; text-decoration: none;">${detailUrl}</a>
       </div>`,
      emailTheme,
    );

    return await this.sendMailWithPrefix({
      from: `${emailTheme?.companyName || 'MedVirtual'} <noreply@medvirtual.ai>`,
      to: [ticket.user.email],
      subject: `You received a response on your ticket: ${ticket.title}`,
      html,
    });
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
      select: { id: true, email: true, first_name: true, last_name: true, role: true },
    });
    if (!creator?.email) throw new BadRequestException('Ticket creator has no email');

    const detailUrl = this.getTicketDetailUrl(ticket.id, creator.role);

    const emailTheme = await getUserEmailTheme(this.prisma, creator.id);

    const authorName = `${note.author?.first_name ?? ''} ${note.author?.last_name ?? ''}`.trim() || 'A user';

    const html = this.buildEmail(
      `<h2>You Received a Response on Your Ticket</h2>
       <p>You received a response on your ticket from <strong>${authorName}</strong>.</p>
       <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
         <h3 style="margin-top: 0; color: #333;">Ticket</h3>
         <p><strong>Title:</strong> ${ticket.title}</p>
         <p><strong>Organization:</strong> ${ticket.organization?.name || 'N/A'}</p>
       </div>
       <div style="background-color: #fff; border: 1px solid #eee; padding: 15px; border-radius: 8px;">
         <h3 style="margin-top: 0; color: #333;">Response</h3>
         <p style="white-space: pre-wrap;">${note.content}</p>
       </div>
       <div style="text-align: left; margin: 30px 0;">
         <a href="${detailUrl}" class="cta-button">View Ticket</a>
       </div>
       <div style="margin-top: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 5px; font-size: 12px; color: #666;">
         <p style="margin: 0 0 5px 0;"><strong>Or copy this link:</strong></p>
         <a href="${detailUrl}" style="color: #01546B; word-break: break-all; text-decoration: none;">${detailUrl}</a>
       </div>`,
      emailTheme,
    );

    return await this.sendMailWithPrefix({
      from: `${emailTheme?.companyName || 'MedVirtual'} <noreply@medvirtual.ai>`,
      to: [creator.email],
      subject: `You received a response on your ticket: ${ticket.title}`,
      html,
    });
  }

  /**
   * Formats a plain text description to preserve formatting in HTML emails.
   * Preserves line breaks, spaces, and indentation using white-space: pre-wrap.
   * Also escapes HTML special characters to prevent XSS.
   */
  private formatDescription(description: string | null | undefined): string {
    if (!description) {
      return '';
    }

    // Escape HTML special characters to prevent XSS
    const escaped = description
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    // Return formatted description with white-space: pre-wrap to preserve formatting
    return `<span style="white-space: pre-wrap;">${escaped}</span>`;
  }

  private formatReferralDescription(description: string): string {
    // Parse the format: Name: ...\nEmail: ...\nMessage: ...
    const lines = description.split('\n');
    const parsed: { name?: string; email?: string; message?: string } = {};

    let currentField: 'name' | 'email' | 'message' | null = null;
    let messageLines: string[] = [];

    lines.forEach(line => {
      const trimmed = line.trim();

      if (trimmed.toLowerCase().startsWith('name:')) {
        // Save previous field if exists
        if (currentField === 'message' && messageLines.length > 0) {
          parsed.message = messageLines.join('\n').trim();
        }
        currentField = 'name';
        parsed.name = trimmed.replace(/^name:\s*/i, '').trim();
        messageLines = [];
      } else if (trimmed.toLowerCase().startsWith('email:')) {
        // Save previous field if exists
        if (currentField === 'message' && messageLines.length > 0) {
          parsed.message = messageLines.join('\n').trim();
        }
        currentField = 'email';
        parsed.email = trimmed.replace(/^email:\s*/i, '').trim();
        messageLines = [];
      } else if (trimmed.toLowerCase().startsWith('message:')) {
        // Save previous field if exists
        if (currentField === 'message' && messageLines.length > 0) {
          parsed.message = messageLines.join('\n').trim();
        }
        currentField = 'message';
        const messageContent = trimmed.replace(/^message:\s*/i, '').trim();
        if (messageContent) {
          messageLines.push(messageContent);
        }
      } else if (currentField === 'message') {
        messageLines.push(trimmed);
      }
    });

    // Save final message if we were collecting it
    if (currentField === 'message' && messageLines.length > 0) {
      parsed.message = messageLines.join('\n').trim();
    }

    // Build simple formatted HTML
    let html = '<div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">';
    html += '<h3 style="margin-top: 0; color: #333;">Candidate Details</h3>';

    if (parsed.name) {
      html += `<p><strong>Name:</strong> ${parsed.name}</p>`;
    }

    if (parsed.email) {
      html += `<p><strong>Email:</strong> <a href="mailto:${parsed.email}" style="color: #01546B; text-decoration: none;">${parsed.email}</a></p>`;
    }

    if (parsed.message) {
      html += `<p><strong>Message:</strong></p>`;
      html += `<p style="white-space: pre-wrap; margin-top: 5px;">${parsed.message}</p>`;
    }

    html += '</div>';

    return html;
  }
}


