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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    UserModule,
    PrismaModule,
    WorkosModule,
    AuthModule,
    RecoverypassModule
  ],
  controllers: [AppController],
  providers: [AppService, WorkosService],
})
export class AppModule {}

