import { Module } from '@nestjs/common';
import { AffiliatesController } from './affiliates.controller';
import { AffiliatesService } from './affiliates.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AffiliatesController],
  providers: [AffiliatesService],
  // Export service so other Med Alliance modules can use requireActiveProfile().
  exports: [AffiliatesService],
})
export class AffiliatesModule {}
