import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserModule } from '../user/user.module';
import { WorkosModule } from '../workos/workos.module';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  imports: [UserModule, WorkosModule],
})
export class AuthModule {}
