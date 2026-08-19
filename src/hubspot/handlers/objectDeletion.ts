import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CandidateAuditFieldGroup, CandidateAuditSource } from '@prisma/client';
import {
  CANDIDATE_AUDIT_EVENTS,
  CandidateAuditService,
} from '../../candidate/candidate-audit.service';

@Injectable()
export class HandlerObjectDeletion {
  constructor(
    private readonly prisma: PrismaService,
    private readonly candidateAudit: CandidateAuditService,
  ) {}

  async execute(event) {
    try {
      const candidateExists = await this.prisma.candidate.findUnique({
        where: {
          hubspot_id: String(event.objectId),
        },
      });
      if (!candidateExists) return;

      //First, delete the candidate skills and languages associated with the candidate
      await this.prisma.candidateSkill.deleteMany({
        where: {
          candidate_id: candidateExists.id,
        },
      });
      await this.prisma.candidateLanguage.deleteMany({
        where: {
          candidate_id: candidateExists.id,
        },
      });
      await this.prisma.candidateEducation.deleteMany({
        where: {
          candidate_id: candidateExists.id,
        },
      });
      await this.prisma.candidateExperience.deleteMany({
        where: {
          candidate_id: candidateExists.id,
        },
      });

      await this.prisma.panelCandidate.deleteMany({
        where: {
          candidate_id: candidateExists.id,
        },
      });

      // Delete the candidate and write the audit log entry atomically: either both
      // commit, or neither does.
      await this.prisma.$transaction(async (tx) => {
        await tx.candidate.delete({
          where: {
            id: candidateExists.id,
          },
        });

        await this.candidateAudit.logOrThrow(
          {
            candidateId: candidateExists.id,
            hubspotId: candidateExists.hubspot_id,
            actorUserId: null,
            event: CANDIDATE_AUDIT_EVENTS.CANDIDATE_DELETED,
            fieldGroup: CandidateAuditFieldGroup.lifecycle,
            before: candidateExists as unknown as Record<string, any>,
            source: CandidateAuditSource.webhook,
          },
          tx,
        );
      });
    } catch (error) {
      throw new BadRequestException('Error deleting candidate', error);
    }
  }
}
