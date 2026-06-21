import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { CandidatesService } from '../candidate/candidates.service';
import { NotificationsService } from '../notifications/notifications.service';
import { HubspotService } from '../hubspot/hubspot.service';
import { HireRequestService } from '../hire-request/hire-request.service';
import { USER } from '@prisma/client';
import { QueryOfferPanelsDto } from './dto/query-offer-panels.dto';
import {
  CreateOfferPanelDto,
  RecipientDto,
} from './dto/create-offer-panel.dto';
import { buildHireRequestTitle } from '../common/utils/hireRequestTitle.util';

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
  hireRequest: {
    select: { id: true, status: true, title: true, createdAt: true },
  },
} as const;

@Injectable()
export class OfferPanelsService {
  private readonly logger = new Logger(OfferPanelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => CandidatesService))
    private readonly candidatesService: CandidatesService,
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => HubspotService))
    private readonly hubspot: HubspotService,
    @Inject(forwardRef(() => HireRequestService))
    private readonly hireRequestService: HireRequestService,
  ) {}

  // Maps the flat recipient_* columns onto the nested `recipient` shape the
  // frontend expects (OfferPanelRecipient in lib/offer-panels/types.ts).
  private withRecipient<T extends Record<string, any>>(
    panel: T,
  ): T & { recipient: Record<string, any> } {
    return {
      ...panel,
      recipient: {
        recipient_type: panel.recipient_type,
        id: panel.recipient_user_id ?? null,
        user_id: panel.recipient_user_id ?? null,
        company_id: panel.recipient_company_id ?? null,
        company_name: panel.recipient_org_name ?? null,
        name: panel.recipient_name,
        email: panel.recipient_email,
      },
    };
  }

  // Loads the full TalentPoolCandidate shape (rates, avatar URL, labels...)
  // for a list of candidate IDs, matching what findOne/findByToken already do.
  private async enrichCandidates(candidateIds: string[]): Promise<any[]> {
    return Promise.all(
      candidateIds.map((id) =>
        this.candidatesService.getTalentPoolCandidateById(id),
      ),
    );
  }

  // Returns the number of other active offer panels (sent or viewed) that also
  // contain this candidate, excluding the current panel.
  private async countOtherPanels(
    candidateId: string,
    excludePanelId: string,
  ): Promise<number> {
    return this.prisma.offerPanelCandidate.count({
      where: {
        candidate_id: candidateId,
        offer_panel_id: { not: excludePanelId },
        offerPanel: { status: { in: ['sent', 'viewed'] } },
      },
    });
  }

  private async retryHubspot<T>(
    fn: () => Promise<T>,
    retries = 3,
    delay = 500,
  ): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (
        retries > 0 &&
        axios.isAxiosError(err) &&
        err.response?.status === 429
      ) {
        await new Promise((r) => setTimeout(r, delay));
        return this.retryHubspot(fn, retries - 1, delay * 2);
      }
      throw err;
    }
  }

  private async warnIfNoHubspotOwner(userId: string): Promise<void> {
    const user = await this.prisma.uSER.findUnique({
      where: { id: userId },
      select: { hubspot_id: true },
    });
    if (!user?.hubspot_id) {
      this.logger.warn(
        `R11 E11: user ${userId} has no hubspot_id — HireRequest HubSpot ticket will have no owner`,
      );
    }
  }

  async searchContacts(q: string, businessUnit: string): Promise<any[]> {
    const term = q.trim();
    const [users, contacts] = await Promise.all([
      this.prisma.uSER.findMany({
        where: {
          role: { in: ['organization_admin', 'organization_super_admin'] },
          organization: { business_unit: businessUnit },
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
          user_id: { not: null },
          user: {
            role: { in: ['organization_admin', 'organization_super_admin'] },
            organization: { business_unit: businessUnit },
          },
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

      if (r.recipient_type === 'client_user') {
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
      } else if (r.recipient_type === 'company_contact') {
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
        const isPublic = r.recipient_type !== 'client_user';

        const panel = await tx.offerPanel.create({
          data: {
            title: dto.title,
            description: dto.description ?? null,
            business_unit: dto.business_unit,
            recipient_type: r.recipient_type,
            recipient_user_id:
              r.recipient_type === 'client_user' ? r.user_id : null,
            recipient_company_id:
              r.recipient_type === 'company_contact' ? r.company_id : null,
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

    const enrichedCandidates = await this.enrichCandidates(dto.candidateIds);

    return createdPanels.map((panel) =>
      this.withRecipient({ ...panel, candidates: enrichedCandidates }),
    );
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
      panel.candidates.map(async (pc) => {
        const enriched = await this.candidatesService.getTalentPoolCandidateById(pc.candidate_id);
        const howManyClientsAreViewing = await this.countOtherPanels(pc.candidate_id, panel.id);
        return { ...enriched, howManyClientsAreViewing };
      }),
    );

    return this.withRecipient({ ...panel, candidates: enrichedCandidates });
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
        const enriched = await this.candidatesService.getTalentPoolCandidateById(pc.candidate_id);
        const howManyClientsAreViewing = await this.countOtherPanels(pc.candidate_id, panel.id);
        return { ...enriched, howManyClientsAreViewing };
      }),
    );

    return this.withRecipient({
      ...panel,
      candidates: enrichedCandidates,
    });
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
        candidates: { select: { candidate_id: true } },
        _count: { select: { candidates: true } },
        hireRequest: {
          select: { id: true, status: true, title: true, createdAt: true },
        },
      },
    });

    return Promise.all(
      panels.map(async (panel) => {
        const enrichedCandidates = await Promise.all(
          panel.candidates.map(async (pc) => {
            const enriched = await this.candidatesService.getTalentPoolCandidateById(pc.candidate_id);
            const howManyClientsAreViewing = await this.countOtherPanels(pc.candidate_id, panel.id);
            return { ...enriched, howManyClientsAreViewing };
          }),
        );
        return this.withRecipient({ ...panel, candidates: enrichedCandidates });
      }),
    );
  }

  // R17 — called explicitly by POST /viewed endpoints; not inline in GET
  async trackView(panelId: string, user?: USER): Promise<void> {
    const panel = await this.prisma.offerPanel.findUnique({
      where: { id: panelId },
      select: { status: true, recipient_user_id: true },
    });
    if (!panel) throw new NotFoundException('Offer panel not found');

    if (
      user &&
      panel.recipient_user_id &&
      panel.recipient_user_id !== user.id
    ) {
      throw new ForbiddenException('Access denied to this offer panel');
    }

    const now = new Date();
    await this.prisma.offerPanel.update({
      where: { id: panelId },
      data: {
        last_viewed_at: now,
        view_count: { increment: 1 },
        ...(panel.status === 'sent'
          ? { status: 'viewed', viewed_at: now }
          : {}),
      },
    });
  }

  async trackViewByToken(token: string): Promise<void> {
    const panel = await this.prisma.offerPanel.findUnique({
      where: { public_token: token },
      select: { id: true, status: true },
    });
    if (!panel) throw new NotFoundException('Offer panel not found');

    const now = new Date();
    await this.prisma.offerPanel.update({
      where: { id: panel.id },
      data: {
        last_viewed_at: now,
        view_count: { increment: 1 },
        ...(panel.status === 'sent'
          ? { status: 'viewed', viewed_at: now }
          : {}),
      },
    });
  }

  async removeCandidate(
    panelId: string,
    candidateId: string,
    clientUser: USER,
  ): Promise<{ deleted: boolean; panel?: any }> {
    const panel = await this.prisma.offerPanel.findUnique({
      where: { id: panelId },
      select: { status: true, recipient_user_id: true },
    });
    if (!panel) throw new NotFoundException('Offer panel not found');

    if (panel.recipient_user_id !== clientUser.id) {
      throw new ForbiddenException('Access denied to this offer panel');
    }
    if (panel.status === 'accepted' || panel.status === 'declined') {
      throw new BadRequestException('Cannot modify a decided offer panel');
    }

    const deleted = await this.prisma.offerPanelCandidate.deleteMany({
      where: { offer_panel_id: panelId, candidate_id: candidateId },
    });
    if (deleted.count === 0) {
      throw new NotFoundException('Candidate not in this panel');
    }

    const remaining = await this.prisma.offerPanelCandidate.count({
      where: { offer_panel_id: panelId },
    });

    if (remaining === 0) {
      await this.prisma.offerPanel.delete({ where: { id: panelId } });
      return { deleted: true };
    }

    const updated = await this.prisma.offerPanel.findUnique({
      where: { id: panelId },
      include: {
        createdBy: {
          select: { id: true, first_name: true, last_name: true, email: true },
        },
        recipientUser: {
          select: { id: true, first_name: true, last_name: true, email: true },
        },
        recipientCompany: { select: { id: true, name: true } },
        candidates: { select: { candidate_id: true } },
      },
    });
    if (!updated) throw new NotFoundException('Offer panel not found');

    const enrichedCandidates = await this.enrichCandidates(
      updated.candidates.map((pc) => pc.candidate_id),
    );

    return {
      deleted: false,
      panel: this.withRecipient({ ...updated, candidates: enrichedCandidates }),
    };
  }

  async removeCandidateFromAllPanels(candidateId: string): Promise<void> {
    const panelLinks = await this.prisma.offerPanelCandidate.findMany({
      where: { candidate_id: candidateId },
      select: { offer_panel_id: true },
    });

    for (const { offer_panel_id } of panelLinks) {
      await this.prisma.offerPanelCandidate.deleteMany({
        where: { offer_panel_id, candidate_id: candidateId },
      });

      const remaining = await this.prisma.offerPanelCandidate.count({
        where: { offer_panel_id },
      });

      if (remaining === 0) {
        await this.prisma.offerPanel.delete({ where: { id: offer_panel_id } });
      }
    }
  }

  async decline(panelId: string, clientUser: USER): Promise<void> {
    const panel = await this.prisma.offerPanel.findUnique({
      where: { id: panelId },
      select: { status: true, recipient_user_id: true },
    });
    if (!panel) throw new NotFoundException('Offer panel not found');

    if (panel.recipient_user_id !== clientUser.id) {
      throw new ForbiddenException('Access denied to this offer panel');
    }
    if (panel.status === 'declined') return; // idempotent (E8)
    if (panel.status === 'accepted') {
      throw new BadRequestException(
        'Cannot decline an already accepted offer panel',
      );
    }

    await this.prisma.offerPanel.update({
      where: { id: panelId },
      data: { status: 'declined', decided_at: new Date() },
    });

    setImmediate(() => {
      this.notificationsService
        .notifyAdminOfferPanelDeclined(panelId)
        .catch(() => {});
    });
  }

  async declineByToken(token: string): Promise<void> {
    const panel = await this.prisma.offerPanel.findUnique({
      where: { public_token: token },
      select: { id: true, status: true },
    });
    if (!panel) throw new NotFoundException('Offer panel not found');

    if (panel.status === 'declined') return; // idempotent (E8)
    if (panel.status === 'accepted') {
      throw new BadRequestException(
        'Cannot decline an already accepted offer panel',
      );
    }

    await this.prisma.offerPanel.update({
      where: { id: panel.id },
      data: { status: 'declined', decided_at: new Date() },
    });

    setImmediate(() => {
      this.notificationsService
        .notifyAdminOfferPanelDeclined(panel.id)
        .catch(() => {});
    });
  }

  private pickMostCommonApprovedPosition(
    approvedPositionsByCandidate: (string[] | null)[],
  ): string | null {
    const positions = approvedPositionsByCandidate.flatMap(
      (positions) => positions ?? [],
    );

    const counts = new Map<string, number>();
    for (const position of positions) {
      if (!position) continue;
      counts.set(position, (counts.get(position) ?? 0) + 1);
    }

    let best: string | null = null;
    let bestCount = 0;
    for (const position of positions) {
      if (!position) continue;
      const count = counts.get(position) ?? 0;
      if (count > bestCount) {
        bestCount = count;
        best = position;
      }
    }

    return best;
  }

  // va_type is a closed HubSpot picklist — approved_positions_pairing values don't always
  // match it exactly, so we validate against HubSpot's live options before sending.
  private async resolveHubspotVaType(
    approvedPosition: string | null,
  ): Promise<string | null> {
    if (!approvedPosition) return null;

    try {
      const vaTypes: Array<{ label: string; value: string }> =
        await this.hireRequestService.getVATypes();
      const isValidOption = vaTypes.some(
        (option) =>
          option.value === approvedPosition ||
          option.label === approvedPosition,
      );
      return isValidOption ? approvedPosition : null;
    } catch (err) {
      this.logger.warn(
        `Failed to fetch HubSpot va_type options: ${(err as Error)?.message}`,
      );
      return null;
    }
  }

  async acceptByClientUser(
    panelId: string,
    clientUser: USER,
  ): Promise<{ hireRequest: any }> {
    const panel = await this.prisma.offerPanel.findUnique({
      where: { id: panelId },
      select: {
        status: true,
        recipient_user_id: true,
        title: true,
        description: true,
        created_by_user_id: true,
      },
    });
    if (!panel) throw new NotFoundException('Offer panel not found');

    if (panel.recipient_user_id !== clientUser.id) {
      throw new ForbiddenException('Access denied to this offer panel');
    }
    if (panel.status === 'declined') {
      throw new BadRequestException('Cannot accept a declined offer panel');
    }

    // Idempotency (E8): return existing hire request if already accepted
    if (panel.status === 'accepted') {
      const existing = await this.prisma.hireRequest.findFirst({
        where: { offer_panel_id: panelId },
      });
      return { hireRequest: existing };
    }

    const candidateRows = await this.prisma.offerPanelCandidate.findMany({
      where: { offer_panel_id: panelId },
      select: {
        candidate_id: true,
        candidate: { select: { approved_positions_pairing: true } },
      },
    });

    const hubspot_role_type = this.pickMostCommonApprovedPosition(
      candidateRows.map((r) => r.candidate.approved_positions_pairing),
    );
    const hubspot_numberVA = candidateRows.length;

    const [org, activeStaffCount] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: clientUser.organization_id ?? '' },
        select: {
          name: true,
          hubspot_id: true,
          business_unit: true,
          website_url: true,
        },
      }),
      this.prisma.staff.count({
        where: {
          organization_id: clientUser.organization_id ?? undefined,
          status: { notIn: ['terminated', 'inactive'] },
          terminated_date: null,
        },
      }),
    ]);

    const pairingRequestType = activeStaffCount > 0 ? 'Upsell Agent' : null;

    const title = buildHireRequestTitle({
      hubspot_pairing_request_type: pairingRequestType,
      hubspot_numberVA,
      hubspot_role_type,
      availability: 'Full-time',
      organization: { name: org?.name ?? '' },
    });

    const hireRequest = await this.prisma.$transaction(async (tx) => {
      const hr = await tx.hireRequest.create({
        data: {
          org_id: clientUser.organization_id ?? '',
          title,
          availability: 'Full-time',
          status: 'panel_ready',
          createdByUserId: panel.created_by_user_id,
          assign_user_id: panel.created_by_user_id,
          hubspot_role_type,
          hubspot_numberVA,
          hubspot_pairing_request_type: pairingRequestType,
          offer_panel_id: panelId,
          panels: {
            create: {
              status: 'created',
              readable: true,
              panelCandidates: {
                create: candidateRows.map((r) => ({
                  candidate_id: r.candidate_id,
                  status: 'selected',
                  createdByUserId: panel.created_by_user_id,
                })),
              },
            },
          },
        },
      });

      await tx.offerPanel.update({
        where: { id: panelId },
        data: { status: 'accepted', decided_at: new Date() },
      });

      return hr;
    });

    setImmediate(() => {
      this.notificationsService
        .notifyAdminOfferPanelAccepted(panelId)
        .catch(() => {});
    });

    // R11 — sync HireRequest to HubSpot with correct owner (fire-and-forget)
    setImmediate(async () => {
      try {
        await this.warnIfNoHubspotOwner(panel.created_by_user_id);

        const hubspot_va_type =
          await this.resolveHubspotVaType(hubspot_role_type);

        const payload = {
          id: hireRequest.id,
          title,
          description: panel.description ?? '',
          availability: 'Full-time',
          priority: 'medium',
          hubspot_role_type: hubspot_va_type,
          hubspot_numberVA,
          hubspot_pairing_request_type: pairingRequestType,
          organization: org ?? {
            name: '',
            hubspot_id: null,
            business_unit: 'MedVirtual',
            website_url: '',
          },
          assign_user_id: [{ id: panel.created_by_user_id }],
        };

        await this.retryHubspot(() =>
          this.hubspot.createHireRequestInHubspot(
            payload as any,
            panel.created_by_user_id,
            'HireRequest created from offer panel accept',
          ),
        );
      } catch (err) {
        this.logger.error(
          `R11: HubSpot sync failed for HR ${hireRequest.id}: ${err?.message}`,
        );
      }
    });

    return { hireRequest };
  }

  async acceptByToken(token: string): Promise<{ ticket: any }> {
    const panel = await this.prisma.offerPanel.findUnique({
      where: { public_token: token },
      select: {
        id: true,
        status: true,
        title: true,
        recipient_name: true,
        recipient_email: true,
        recipient_company_id: true,
        created_by_user_id: true,
      },
    });
    if (!panel) throw new NotFoundException('Offer panel not found');

    if (panel.status === 'declined') {
      throw new BadRequestException('Cannot accept a declined offer panel');
    }

    // Idempotency (E8)
    if (panel.status === 'accepted') {
      const existing = await this.prisma.ticket.findFirst({
        where: { offer_panel_id: panel.id },
        orderBy: { createdAt: 'desc' },
      });
      return { ticket: existing };
    }

    const ticket = await this.prisma.$transaction(async (tx) => {
      const t = await tx.ticket.create({
        data: {
          type: 'offer_panel',
          title: 'Offer panel accepted',
          description: `The offer panel ${panel.title} was accepted by ${panel.recipient_name}`,
          priority: 'medium',
          offer_panel_id: panel.id,
          org_id: panel.recipient_company_id ?? null,
          created_by: panel.created_by_user_id,
        },
      });

      await tx.offerPanel.update({
        where: { id: panel.id },
        data: { status: 'accepted', decided_at: new Date() },
      });

      return t;
    });

    setImmediate(() => {
      this.notificationsService
        .notifyAdminOfferPanelAccepted(panel.id)
        .catch(() => {});
    });

    return { ticket };
  }

  async update(
    id: string,
    dto: { title?: string; description?: string },
  ): Promise<any> {
    const panel = await this.prisma.offerPanel.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!panel) throw new NotFoundException('Offer panel not found');

    const updated = await this.prisma.offerPanel.update({
      where: { id },
      data: dto,
      include: {
        candidates: { select: { candidate_id: true } },
      },
    });

    const enrichedCandidates = await this.enrichCandidates(
      updated.candidates.map((pc) => pc.candidate_id),
    );

    return this.withRecipient({ ...updated, candidates: enrichedCandidates });
  }

  async remove(id: string): Promise<void> {
    const panel = await this.prisma.offerPanel.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!panel) throw new NotFoundException('Offer panel not found');

    await this.prisma.offerPanel.delete({ where: { id } });
  }

  async findAll(
    query: QueryOfferPanelsDto,
  ): Promise<{ data: any[]; pagination: any }> {
    const {
      search,
      status,
      recipient_type,
      client,
      page = 1,
      limit = 20,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) where.status = status;
    if (recipient_type) where.recipient_type = recipient_type;
    if (client)
      where.recipient_org_name = { contains: client, mode: 'insensitive' };

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
          candidates: { select: { candidate_id: true } },
          recipientCompany: { select: { id: true, name: true } },
          _count: { select: { candidates: true } },
          hireRequest: {
            select: { id: true, status: true, title: true, createdAt: true },
          },
        },
      }),
      this.prisma.offerPanel.count({ where }),
    ]);

    // enhance the result to align with frontend types
    const enhancedData = await Promise.all(
      data.map(async (panel) => {
        const enrichedCandidates = await this.enrichCandidates(
          panel.candidates.map((pc) => pc.candidate_id),
        );
        return this.withRecipient({ ...panel, candidates: enrichedCandidates });
      }),
    );

    return {
      data: enhancedData,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByCandidateId(candidateId: string) {
    return this.prisma.offerPanel.findMany({
      where: {
        candidates: { some: { candidate_id: candidateId } },
      },
      select: {
        id: true,
        title: true,
        status: true,
        recipient_name: true,
        recipient_type: true,
      },
      orderBy: { createdAt: 'desc' },
    });
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
