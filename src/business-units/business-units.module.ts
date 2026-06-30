import { Module } from '@nestjs/common';
import { BusinessUnitsService } from './business-units.service';
import { BusinessUnitsController } from './business-units.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BusinessUnitsController],
  providers: [BusinessUnitsService],
  exports: [BusinessUnitsService],
})
export class BusinessUnitsModule {}
