import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CandidatesService } from '../candidate/candidates.service';
import { NotificationsService } from '../notifications/notifications.service';
import { USER } from '@prisma/client';
import { QueryOfferPanelsDto } from './dto/query-offer-panels.dto';
import {
  CreateOfferPanelDto,
  RecipientDto,
} from './dto/create-offer-panel.dto';

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
    private readonly notificationsService: NotificationsService,
  ) {}

  async searchContacts(q: string): Promise<any[]> {
    const term = q.trim();

    const [users, contacts] = await Promise.all([
      this.prisma.uSER.findMany({
        where: {
          role: { in: ['organization_admin', 'organization_super_admin'] },
          OR: [
            { first_name: { contains: term, mode: 'insensitive' } },
            { last_name: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          organization: { select: { id: true, name: true } },
        },
        take: 20,
      }),
      this.prisma.contact.findMany({
        where: {
          organization_id: { not: null },
          OR: [
            { first_name: { contains: term, mode: 'insensitive' } },
            { last_name: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
            { company_name: { contains: term, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          company_name: true,
          user_id: true,
          organization: { select: { id: true, name: true } },
        },
        take: 20,
      }),
    ]);

    // Users take priority; track emails already covered
    const seenEmails = new Set<string>();
    const results: any[] = [];

    for (const u of users) {
      if (!u.email) continue;
      seenEmails.add(u.email.toLowerCase());
      results.push({
        id: u.id,
        name: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim(),
        email: u.email,
        company_name: u.organization?.name ?? null,
        company_id: u.organization?.id ?? null,
        recipient_type: 'client_user',
        user_id: u.id,
      });
    }

    for (const c of contacts) {
      if (!c.email) continue;
      if (seenEmails.has(c.email.toLowerCase())) continue;
      seenEmails.add(c.email.toLowerCase());
      results.push({
        id: c.id,
        name: `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim(),
        email: c.email,
        company_name: c.company_name ?? c.organization?.name ?? null,
        company_id: c.organization?.id ?? null,
        recipient_type: c.user_id ? 'client_user' : 'company_contact',
        user_id: c.user_id ?? null,
      });
    }

    return results.slice(0, 20);
  }

  async create(dto: CreateOfferPanelDto, adminUser: USER): Promise<any[]> {
    // --- Validation phase (no DB writes yet) ---
    const errors: string[] = [];

    // Validate candidates exist
    const candidates = await this.prisma.candidate.findMany({
      where: { id: { in: dto.candidateIds } },
      select: { id: true },
    });
    const foundCandidateIds = new Set(candidates.map((c) => c.id));
    const missingCandidates = dto.candidateIds.filter(
      (id) => !foundCandidateIds.has(id),
    );
    if (missingCandidates.length > 0) {
      errors.push(`Candidates not found: ${missingCandidates.join(', ')}`);
    }

    // Validate recipients and collect org names
    const emailsSeen = new Set<string>();
    const recipientMeta: Array<{
      orgName: string | null;
      resolvedUserId: string | null;
    }> = [];

    for (let i = 0; i < dto.recipients.length; i++) {
      const r = dto.recipients[i];
      const label = `Recipient ${i + 1} (${r.email})`;

      // Duplicate email check
      const emailKey = r.email.toLowerCase();
      if (emailsSeen.has(emailKey)) {
        errors.push(`${label}: duplicate email in batch`);
      }
      emailsSeen.add(emailKey);

      let orgName: string | null = null;
      let resolvedUserId: string | null = null;

      if (r.type === 'client_user') {
        if (!r.user_id) {
          errors.push(`${label}: user_id is required for type client_user`);
          recipientMeta.push({ orgName: null, resolvedUserId: null });
          continue;
        }
        const user = await this.prisma.uSER.findUnique({
          where: { id: r.user_id },
          select: {
            id: true,
            role: true,
            organization: { select: { name: true } },
          },
        });
        if (!user) {
          errors.push(`${label}: user_id ${r.user_id} not found`);
        } else if (
          user.role !== 'organization_admin' &&
          user.role !== 'organization_super_admin'
        ) {
          errors.push(
            `${label}: user must be an organization admin, got role '${user.role}'`,
          );
        } else {
          orgName = user.organization?.name ?? null;
          resolvedUserId = user.id;
        }
      } else if (r.type === 'company_contact') {
        if (!r.company_id) {
          errors.push(
            `${label}: company_id is required for type company_contact`,
          );
          recipientMeta.push({ orgName: null, resolvedUserId: null });
          continue;
        }
        const org = await this.prisma.organization.findUnique({
          where: { id: r.company_id },
          select: { name: true },
        });
        if (!org) {
          errors.push(`${label}: company_id ${r.company_id} not found`);
        } else {
          orgName = org.name;
        }
      }
      // type === 'email': no id needed, orgName stays null

      recipientMeta.push({ orgName, resolvedUserId });
    }

    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }

    // --- Creation phase ---
    const createdPanels = await this.prisma.$transaction(async (tx) => {
      const panels: any[] = [];

      for (let i = 0; i < dto.recipients.length; i++) {
        const r: RecipientDto = dto.recipients[i];
        const { orgName } = recipientMeta[i];
        const isPublic = r.type !== 'client_user';

        const panel = await tx.offerPanel.create({
          data: {
            title: dto.title,
            description: dto.description ?? null,
            business_unit: dto.business_unit,
            recipient_type: r.type,
            recipient_user_id: r.type === 'client_user' ? r.user_id : null,
            recipient_company_id:
              r.type === 'company_contact' ? r.company_id : null,
            recipient_name: r.name,
            recipient_email: r.email,
            recipient_org_name: orgName,
            is_public: isPublic,
            public_token: isPublic ? randomUUID() : null,
            created_by_user_id: adminUser.id,
            candidates: {
              create: dto.candidateIds.map((cid) => ({ candidate_id: cid })),
            },
          },
        });
        panels.push(panel);
      }

      return panels;
    });

    // Fire notifications non-blocking after transaction
    Promise.allSettled(
      createdPanels.map((panel) => {
        const isPublic = panel.is_public;
        return isPublic
          ? this.notificationsService.notifyOfferPanelCreatedPublic(panel.id)
          : this.notificationsService.notifyOfferPanelCreatedClient(panel.id);
      }),
    );

    return createdPanels;
  }

  async findByToken(token: string): Promise<any> {
    const panel = await this.prisma.offerPanel.findUnique({
      where: { public_token: token },
      include: OFFER_PANEL_INCLUDE,
    });

    if (!panel) {
      throw new NotFoundException('Offer panel not found');
    }

    const enrichedCandidates = await Promise.all(
      panel.candidates.map((pc) =>
        this.candidatesService.getTalentPoolCandidateById(pc.candidate_id),
      ),
    );

    const result = { ...panel, candidates: enrichedCandidates };

    // Best-effort view tracking — R17
    setImmediate(async () => {
      try {
        const now = new Date();
        await this.prisma.offerPanel.update({
          where: { public_token: token },
          data: {
            last_viewed_at: now,
            view_count: { increment: 1 },
            ...(panel.status === 'sent' ? { status: 'viewed', viewed_at: now } : {}),
          },
        });
      } catch {
        // swallow
      }
    });

    return result;
  }

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
    const { search, status, recipient_type, client, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) where.status = status;
    if (recipient_type) where.recipient_type = recipient_type;
    if (client) where.recipient_org_name = { contains: client, mode: 'insensitive' };

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
