import { Module } from '@nestjs/common';
import { HireRequestService } from './hire-request.service';
import { HireRequestController } from './hire-request.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [HireRequestController],
  providers: [HireRequestService],
  imports: [PrismaModule],
})
export class HireRequestModule {}
