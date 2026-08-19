import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CandidateAuditService } from './candidate-audit.service';

@Module({
  imports: [PrismaModule],
  providers: [CandidateAuditService],
  exports: [CandidateAuditService],
})
export class CandidateAuditModule {}
