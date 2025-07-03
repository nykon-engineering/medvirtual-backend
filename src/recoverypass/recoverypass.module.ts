import { Module } from '@nestjs/common';
import { RecoverypassController } from './recoverypass.controller';
import { RecoverypassService } from './recoverypass.service';
import { UserModule } from '../user/user.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';


@Module({
  controllers: [RecoverypassController],
  providers: [RecoverypassService],
  imports: [UserModule, PrismaModule, MailModule],
})
export class RecoverypassModule {}
