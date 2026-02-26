import { forwardRef, Module } from '@nestjs/common';
import { HireRequestService } from './hire-request.service';
import { HireRequestController } from './hire-request.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { HubspotModule } from '../hubspot/hubspot.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OpenaiModule } from '../openai/openai.module';

@Module({
  controllers: [HireRequestController],
  providers: [HireRequestService],
  imports: [PrismaModule, NotificationsModule, forwardRef(() => HubspotModule), OpenaiModule],
  exports: [HireRequestService],
})
export class HireRequestModule {}
