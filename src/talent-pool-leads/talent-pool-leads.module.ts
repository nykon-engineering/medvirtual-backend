import { Module } from '@nestjs/common';
import { TalentPoolLeadsController } from './talent-pool-leads.controller';
import { TalentPoolLeadsService } from './talent-pool-leads.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  controllers: [TalentPoolLeadsController],
  providers: [TalentPoolLeadsService],
  imports: [PrismaModule, NotificationsModule],
  exports: [TalentPoolLeadsService],
})
export class TalentPoolLeadsModule {}

