import { Module } from '@nestjs/common';
import { OpenaiService } from './openai.service';
import { MailModule } from '../mail/mail.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OpenrouterModule } from '../openrouter/openrouter.module';

@Module({
  providers: [OpenaiService],
  exports: [OpenaiService],
  imports: [MailModule, PrismaModule, OpenrouterModule],
})
export class OpenaiModule {}
