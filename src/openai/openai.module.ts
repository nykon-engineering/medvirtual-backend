import { Module } from '@nestjs/common';
import { OpenaiService } from './openai.service';
import { MailModule } from '../mail/mail.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  providers: [OpenaiService],
  exports: [OpenaiService],
  imports: [MailModule, PrismaModule],
})
export class OpenaiModule {}
