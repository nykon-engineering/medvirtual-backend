import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { HubspotModule } from '../hubspot/hubspot.module';

@Module({
  providers: [UserService],
  controllers: [UserController],
  imports: [PrismaModule, MailModule, HubspotModule],
  exports: [UserService],
})
export class UserModule {}
