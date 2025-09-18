import { Module } from '@nestjs/common';
import { OpenaiService } from './openai.service';
import { MailModule } from '../mail/mail.module';

@Module({
  providers: [OpenaiService],
  exports: [OpenaiService],
  imports: [MailModule],
})
export class OpenaiModule {}
