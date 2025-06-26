import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { WorkosService } from './workos/workos.service';
import { WorkosModule } from './workos/workos.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    UserModule,
    PrismaModule,
    WorkosModule
  ],
  controllers: [AppController],
  providers: [AppService, WorkosService],
})
export class AppModule {}

