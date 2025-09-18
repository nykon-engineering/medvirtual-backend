import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkosModule } from '../workos/workos.module';
import { MailModule } from '../mail/mail.module';

@Module({
  providers: [UserService],
  controllers: [UserController],
  imports: [PrismaModule, WorkosModule, MailModule],
  exports: [UserService]
})
export class UserModule {}
