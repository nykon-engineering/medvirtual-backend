import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserModule } from '../user/user.module';
import { WorkosModule } from '../workos/workos.module';
import { MailModule } from '../mail/mail.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  imports: [UserModule, WorkosModule, MailModule, PrismaModule],
  exports: [AuthService]
})
export class AuthModule {}
