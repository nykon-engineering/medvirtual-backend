import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { MailModule } from '../mail/mail.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [MailModule, PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}


