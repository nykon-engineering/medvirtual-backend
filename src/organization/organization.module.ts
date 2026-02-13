import { forwardRef, Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { HubspotModule } from '../hubspot/hubspot.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SqsModule } from '../sqs/sqs.module';

@Module({
  controllers: [OrganizationController],
  providers: [OrganizationService],
  imports: [PrismaModule, 
    forwardRef(() =>AuthModule), 
    forwardRef(() => HubspotModule), 
    NotificationsModule,
    SqsModule],
  exports: [OrganizationService],
})
export class OrganizationModule {}
