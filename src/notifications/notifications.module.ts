import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { MailModule } from '../mail/mail.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailTemplatesModule } from '../email-templates/email-templates.module';
// Prisma-only leaf module. Imported (rather than CandidatesModule, which already
// imports this one and would be circular) so the offer-panel email can compute
// candidate bill rates for its cards.
import { PositionRateConfigModule } from '../position-rate-config/position-rate-config.module';

@Module({
  imports: [
    MailModule,
    PrismaModule,
    EmailTemplatesModule,
    PositionRateConfigModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
