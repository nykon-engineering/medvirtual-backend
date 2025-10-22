import { Module } from '@nestjs/common';
import { EmailTestController } from './email-test.controller';
import { EmailTestService } from './email-test.service';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [MailModule, NotificationsModule],
  controllers: [EmailTestController],
  providers: [EmailTestService],
})
export class EmailTestModule {}
