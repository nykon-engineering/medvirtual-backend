import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from './notifications.service';
import { SendNotificationDto } from './dto/send-notification.dto';


@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly mailService: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  @Post()
  @HttpCode(200)
  @ApiBody({ type: SendNotificationDto })
  @ApiOperation({ summary: 'Send a notification email' })
  @ApiResponse({ status: 200, description: 'Email sent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request or sending failed' })
  async send(@Body() body: SendNotificationDto) {
    const result = await this.mailService.sendMail({
      from: body.from,
      to: body.to,
      cc: body.cc,
      subject: body.subject,
      html: body.html,
    });

    return {
      status: 200,
      message: 'Email sent successfully',
      data: result,
    };
  }

  @Post('hire-request/:id/placement-completed')
  @HttpCode(200)
  @ApiParam({ name: 'id', required: true })
  @ApiOperation({ summary: 'Notify assignee: placement completed' })
  async notifyPlacementCompleted(@Param('id') id: string) {
    const ok = await this.notifications.notifyHireRequestPlacementCompleted(id);
    return { status: 200, message: 'Notification sent', data: ok };
  }

  @Post('hire-request/:id/client-edited')
  @HttpCode(200)
  @ApiParam({ name: 'id', required: true })
  @ApiOperation({ summary: 'Notify assignee: client edited hire request' })
  async notifyHireRequestEdited(@Param('id') id: string) {
    const ok = await this.notifications.notifyHireRequestClientChange(id, 'edited');
    return { status: 200, message: 'Notification sent', data: ok };
  }

  @Post('hire-request/:id/client-canceled')
  @HttpCode(200)
  @ApiParam({ name: 'id', required: true })
  @ApiOperation({ summary: 'Notify assignee: client canceled hire request' })
  async notifyHireRequestCanceled(@Param('id') id: string) {
    const ok = await this.notifications.notifyHireRequestClientChange(id, 'canceled');
    return { status: 200, message: 'Notification sent', data: ok };
  }

  @Post('ticket/:id/created')
  @HttpCode(200)
  @ApiParam({ name: 'id', required: true })
  @ApiOperation({ summary: 'Notify assignee: ticket created' })
  async notifyTicketCreated(@Param('id') id: string) {
    const ok = await this.notifications.notifyTicketEvent(id, 'created');
    return { status: 200, message: 'Notification sent', data: ok };
  }

  @Post('ticket/:id/assigned')
  @HttpCode(200)
  @ApiParam({ name: 'id', required: true })
  @ApiOperation({ summary: 'Notify assignee: ticket assigned' })
  async notifyTicketAssigned(@Param('id') id: string) {
    const ok = await this.notifications.notifyTicketEvent(id, 'assigned');
    return { status: 200, message: 'Notification sent', data: ok };
  }

  @Post('ticket/:id/canceled')
  @HttpCode(200)
  @ApiParam({ name: 'id', required: true })
  @ApiOperation({ summary: 'Notify assignee: ticket canceled' })
  async notifyTicketCanceled(@Param('id') id: string) {
    const ok = await this.notifications.notifyTicketEvent(id, 'canceled');
    return { status: 200, message: 'Notification sent', data: ok };
  }
}


