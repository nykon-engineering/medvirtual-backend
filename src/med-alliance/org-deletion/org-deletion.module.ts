import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ReviewCasesModule } from '../review-cases/review-cases.module';
import { AllianceNotificationsModule } from '../notifications/notifications.module';
import { OrgDeletionService } from './org-deletion.service';

// Deliberately kept free of HubspotModule imports so HubspotModule can import
// this module without creating a circular dependency.
@Module({
  imports: [PrismaModule, ReviewCasesModule, AllianceNotificationsModule],
  providers: [OrgDeletionService],
  exports: [OrgDeletionService],
})
export class OrgDeletionModule {}
