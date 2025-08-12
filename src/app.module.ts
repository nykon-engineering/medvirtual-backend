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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
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
    HireRequestModule
  ],
  controllers: [AppController],
  providers: [AppService, WorkosService],
})
export class AppModule {}

