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
        status: true,
        assigned_user: {
          select: { email: true, first_name: true, last_name: true },
        },
      },
    });
    if (!hr) throw new NotFoundException('Hire request not found');
    if (!hr.assigned_user?.email)
      throw new BadRequestException('Hire request has no assignee email');

    const html = this.buildEmail(
      `<h2>Placement Completed</h2>
       <p>The hire request "${hr.title}" has been marked as <strong>placement completed</strong>.</p>
       <p>Please proceed with onboarding steps.</p>`,
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
        assigned_user: { select: { email: true } },
      },
    });
    if (!hr) throw new NotFoundException('Hire request not found');
    if (!hr.assigned_user?.email)
      throw new BadRequestException('Hire request has no assignee email');

    const verb = action === 'edited' ? 'edited' : 'canceled';
    const html = this.buildEmail(
      `<h2>Hire Request ${verb.toUpperCase()}</h2>
       <p>The hire request "${hr.title}" was ${verb} by the client.</p>`,
    );

    return await this.mail.sendMail({
      from: 'MedVirtual <noreply@medvirtual.ai>',
      to: [hr.assigned_user.email],
      subject: `Hire Request ${verb}: ${hr.title}`,
      html,
    });
  }

  async notifyTicketEvent(ticketId: string, event: 'created' | 'assigned' | 'canceled'): Promise<boolean> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        title: true,
        status: true,
        user: { select: { email: true } }, // assignee
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const to = ticket.user?.email ? [ticket.user.email] : undefined;
    if (!to || to.length === 0) throw new BadRequestException('Ticket has no assignee email');

    const html = this.buildEmail(
      `<h2>Ticket ${event.toUpperCase()}</h2>
       <p>The ticket "${ticket.title}" was ${event}.</p>`,
    );

    return await this.mail.sendMail({
      from: 'MedVirtual <noreply@medvirtual.ai>',
      to,
      subject: `Ticket ${event}: ${ticket.title}`,
      html,
    });
  }
}


