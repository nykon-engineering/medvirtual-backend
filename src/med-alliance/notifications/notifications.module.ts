import { Module } from '@nestjs/common';
import { MailModule } from '../../mail/mail.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { AllianceNotificationsService } from './notifications.service';
import { EmailTemplatesModule } from '../../email-templates/email-templates.module';

@Module({
  imports: [MailModule, PrismaModule, EmailTemplatesModule],
  providers: [AllianceNotificationsService],
  exports: [AllianceNotificationsService],
})
export class AllianceNotificationsModule {}
