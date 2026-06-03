import { Module } from '@nestjs/common';
import { MailModule } from '../../mail/mail.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { AllianceNotificationsService } from './notifications.service';

@Module({
  imports: [MailModule, PrismaModule],
  providers: [AllianceNotificationsService],
  exports: [AllianceNotificationsService],
})
export class AllianceNotificationsModule {}
