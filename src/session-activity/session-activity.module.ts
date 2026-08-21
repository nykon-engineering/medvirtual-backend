import { Module } from '@nestjs/common';
import { SessionActivityController } from './session-activity.controller';
import { SessionActivityService } from './session-activity.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [SessionActivityController],
  providers: [SessionActivityService],
  imports: [PrismaModule],
  exports: [SessionActivityService],
})
export class SessionActivityModule {}
