import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { WorkosService } from './workos/workos.service';
import { WorkosModule } from './workos/workos.module';
import { AuthModule } from './auth/auth.module';
import { RecoverypassModule } from './recoverypass/recoverypass.module';
import { HubspotModule } from './hubspot/hubspot.module';
import { GoogledriveModule } from './googledrive/googledrive.module';
import { OrganizationModule } from './organization/organization.module';
import { CandidatesModule } from './candidate/candidates.module';
import { TextractModule } from './textract/textract.module';
import { S3Module } from './s3/s3.module';
import { OpenaiModule } from './openai/openai.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CronModule } from './cron/cron.module';
import { HireRequestModule } from './hire-request/hire-request.module';
import { TicketModule } from './ticket/ticket.module';
import { StaffModule } from './staff/staff.module';
import { NotificationsModule } from './notifications/notifications.module';
import { EmailTestModule } from './email-test/email-test.module';
import { PanelModule } from './panel/panel.module';
import { TalentPoolLeadsModule } from './talent-pool-leads/talent-pool-leads.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000, // 1 minute
      limit: 100, // 100 requests per minute (global default, can be overridden per endpoint)
    }]),
    UserModule,
    PrismaModule,
    WorkosModule,
    AuthModule,
    RecoverypassModule,
    HubspotModule,
    GoogledriveModule,
    OrganizationModule,
    CandidatesModule,
    TextractModule,
    S3Module,
    OpenaiModule,
    DashboardModule,
    CronModule,
    HireRequestModule,
    TicketModule,
    StaffModule,
    NotificationsModule,
    EmailTestModule,
    PanelModule,
    TalentPoolLeadsModule
  ],
  controllers: [AppController],
  providers: [
    AppService, 
    WorkosService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

