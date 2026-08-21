import { forwardRef, Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { HubspotModule } from '../hubspot/hubspot.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SqsModule } from '../sqs/sqs.module';
import { ContactModule } from '../contacts/contacts.module';
import { BusinessUnitsModule } from '../business-units/business-units.module';
import { CandidateAuditModule } from '../candidate/candidate-audit.module';

@Module({
  controllers: [OrganizationController],
  providers: [OrganizationService],
  imports: [
    PrismaModule,
    forwardRef(() => AuthModule),
    forwardRef(() => HubspotModule),
    NotificationsModule,
    SqsModule,
    ContactModule,
    BusinessUnitsModule,
    CandidateAuditModule,
  ],
  exports: [OrganizationService],
})
export class OrganizationModule {}
