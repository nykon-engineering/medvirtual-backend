import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CandidatesService } from '../candidate/candidates.service';
import { USER } from '@prisma/client';
import { QueryOfferPanelsDto } from './dto/query-offer-panels.dto';

const CANDIDATE_CARD_SELECT = {
  id: true,
  hubspot_id: true,
  first_name: true,
  last_name: true,
  name: true,
  country: true,
  employment_type: true,
  hourly_pay_rate: true,
  years_of_experience: true,
  about_me: true,
  specialization: true,
  tools: true,
  medical_tools: true,
  avatar_url: true,
  gender: true,
  shift_block: true,
  video_link: true,
  approved_positions_pairing: true,
  business_unit: true,
  active_listening_and_comprehension_demonstrated: true,
  adaptability_to_different_client_personalities_and_workflows: true,
  can_articulate_experience_clearly_to_clients: true,
  can_multitask_between_systems_or_windows_efficiently: true,
  client_readiness___fit_evaluator_notes: true,
  comfortable_with_basic_tools__google_workspace__zoom__ehr_software_: true,
  comfortable_with_camera_on_setup: true,
  communication_skills_evaluator_notes: true,
  confident_on_video_and_phone_calls: true,
  cultural_alignment_with_us_healthcare_environment: true,
  demonstrates_problem_solving_and_tech_adaptability: true,
  demonstrates_stability_and_commitment: true,
  demonstrates_understanding_of_medical_terminology_and_procedures: true,
  exhibits_confidence_and_empathy_in_roleplay_scenarios: true,
  familiarity_with_emr_ehr_systems__kareo__athena__eclinicalworks__etc__: true,
  for_bilinguals__fluent_and_accurate_in_both_english_and_spanish: true,
  grammar__vocabulary__and_tone_are_appropriate_for_us_clients: true,
  handles_feedback_constructively: true,
  has_functioning_headset__webcam__and_backup_device: true,
  knowledge_of_hipaa_compliance_and_confidentiality: true,
  medical_knowledge_evaluator_notes: true,
  no_medical_industry_experience: true,
  positive_attitude_and_professional_demeanor: true,
  prior_experience_in_healthcare_or_medical_va_roles: true,
  professionalism___work_readiness_evaluator_notes: true,
  punctual_and_responsive_during_recruitment_stages: true,
  remote_work_discipline_and_time_management: true,
  speaks_clearly_and_professionally: true,
  stable_internet_connection__min__20_mbps_: true,
  technical_competence_evaluator_notes: true,
  tier_level: true,
  total_points: true,
  understands_workflow_in_medical_offices___telehealth_environments: true,
  languages: { select: { name: true } },
  skills: { select: { skill_name: true, skill_type: true } },
  educations: { select: { institution: true, degree: true, year: true } },
  experiences: {
    orderBy: { start_date: 'desc' as const },
    select: {
      company: true,
      position: true,
      start_date: true,
      end_date: true,
      responsabilities: true,
    },
  },
} as const;

const OFFER_PANEL_INCLUDE = {
  createdBy: {
    select: { id: true, first_name: true, last_name: true, email: true },
  },
  recipientUser: {
    select: { id: true, first_name: true, last_name: true, email: true },
  },
  recipientCompany: {
    select: { id: true, name: true },
  },
  candidates: {
    select: {
      id: true,
      candidate_id: true,
      createdAt: true,
      candidate: { select: CANDIDATE_CARD_SELECT },
    },
  },
} as const;

@Injectable()
export class OfferPanelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly candidatesService: CandidatesService,
  ) {}

  async findOne(id: string, user: USER): Promise<any> {
    const panel = await this.prisma.offerPanel.findUnique({
      where: { id },
      include: OFFER_PANEL_INCLUDE,
    });

    if (!panel) {
      throw new NotFoundException('Offer panel not found');
    }

    this.assertAccess(panel, user);

    const enrichedCandidates = await Promise.all(
      panel.candidates.map(async (pc) => {
        const enriched =
          await this.candidatesService.getTalentPoolCandidateById(
            pc.candidate_id,
          );
        return enriched;
      }),
    );

    return {
      ...panel,
      candidates: enrichedCandidates,
    };
  }

  async findForClientUser(clientUser: USER): Promise<any[]> {
    const panels = await this.prisma.offerPanel.findMany({
      where: {
        recipient_user_id: clientUser.id,
        status: { notIn: ['declined'] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, first_name: true, last_name: true, email: true },
        },
        _count: { select: { candidates: true } },
      },
    });
    return panels;
  }

  async findAll(
    query: QueryOfferPanelsDto,
  ): Promise<{ data: any[]; pagination: any }> {
    const { search, status, recipient_type, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) where.status = status;
    if (recipient_type) where.recipient_type = recipient_type;

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { recipient_name: { contains: search, mode: 'insensitive' } },
        { recipient_email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.offerPanel.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
          recipientUser: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
          recipientCompany: { select: { id: true, name: true } },
          _count: { select: { candidates: true } },
        },
      }),
      this.prisma.offerPanel.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Allows admin to see any panel; client can only see panels addressed to them.
  private assertAccess(panel: any, user: USER): void {
    const isAdmin =
      user.role === 'system_admin' || user.role === 'system_super_admin';
    if (isAdmin) return;

    const isRecipient = panel.recipient_user_id === user.id;

    if (!isRecipient) {
      throw new ForbiddenException('Access denied to this offer panel');
    }
  }
}
