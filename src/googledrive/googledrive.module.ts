import { Module } from '@nestjs/common';
import { GoogledriveController } from './googledrive.controller';
import { GoogledriveService } from './googledrive.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';

@Module({
  controllers: [GoogledriveController],
  providers: [GoogledriveService],
  imports: [PrismaModule, MailModule],
  exports: [GoogledriveService],
})
export class GoogledriveModule {}
