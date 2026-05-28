import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTalentPoolLeadDto } from './dto/create-talent-pool-lead.dto';
import { UpdateTalentPoolLeadDto } from './dto/update-talent-pool-lead.dto';
import { QueryTalentPoolLeadsDto } from './dto/query-talent-pool-leads.dto';
import { Priority } from '@prisma/client';
import { ticketTypeDictionary } from '../common/dictionaries/ticket-type';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TalentPoolLeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Check rate limit: maximum 3 submissions per email per day
   */
  private async checkRateLimit(email: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const submissionsToday = await this.prisma.talentPoolLead.count({
      where: {
        email,
        created_at: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    if (submissionsToday >= 3) {
      throw new BadRequestException(
        'Maximum 3 submissions per email per day. Please try again tomorrow.',
      );
    }
  }

  private salesTeamEmails_MedVirtual = [
    'heather@medvirtual.ai',
    'lyndsey@medvirtual.ai',
    'nilad@medvirtual.ai',
    'ava@medvirtual.ai',
    'christina@medvirtual.ai',
    'vanessa.gudiel@medvirtual.ai',
  ];
  private salesTeamEmails_BerryVirtual = ['kimberly@berryvirtual.ai'];

  private SDRTeamEmails_MedVirtual = [
    'nilad@medvirtual.ai',
    'noel.alcarion@medvirtual.ai',
    'ricky.olivares@medvirtual.ai',
    'cristie.baldemor@medvirtual.ai',
  ];

  private SDRTeamEmails_BerryVirtual = ['maureen@berryvirtual.ai'];

  async getOwnerId(emailUser: string): Promise<string | null> {
    if (!emailUser) return null;
    const user = await this.prisma.uSER.findUnique({
      where: { email: emailUser },
      select: {
        id: true,
        hubspot_id: true,
        first_name: true,
        last_name: true,
        email: true,
      },
    });

    return user && user.hubspot_id ? user.hubspot_id : null;
  }
  /**
   * Create a new talent pool lead
   */
  async create(createDto: CreateTalentPoolLeadDto): Promise<any> {
    // Check rate limit
    await this.checkRateLimit(createDto.email);

    // Check for duplicate (email + source combination)
    const existingLead = await this.prisma.talentPoolLead.findFirst({
      where: {
        email: createDto.email.toLowerCase().trim(),
        source: createDto.source,
      },
    });

    if (existingLead) {
      throw new ConflictException(
        'Lead with this email already exists for this source',
      );
    }

    // Sanitize inputs (basic sanitization - remove potential XSS)
    const sanitizedFirstName = this.sanitizeInput(createDto.first_name);
    const sanitizedLastName = this.sanitizeInput(createDto.last_name);
    const sanitizedName = `${sanitizedFirstName} ${sanitizedLastName}`;
    const sanitizedOrganization = this.sanitizeInput(createDto.organization);
    const sanitizedWebsiteUrl = this.sanitizeInput(createDto.website_url);
    const sanitizedMainNeed = createDto.main_need
      ? this.sanitizeInput(createDto.main_need)
      : null;
    const sanitizedAdditionalDetails = createDto.additional_details
      ? this.sanitizeInput(createDto.additional_details)
      : null;

    // Create the lead
    const lead = await this.prisma.talentPoolLead.create({
      data: {
        name: sanitizedName,
        first_name: sanitizedFirstName,
        last_name: sanitizedLastName,
        email: createDto.email.toLowerCase().trim(),
        organization: sanitizedOrganization,
        website_url: sanitizedWebsiteUrl,
        language_preference: createDto.language_preference,
        main_need: sanitizedMainNeed,
        additional_details: sanitizedAdditionalDetails,
        source: createDto.source,
        type: 'Talent Pool Inquiry',
        status: 'new',
      },
      select: {
        id: true,
        name: true,
        first_name: true,
        last_name: true,
        email: true,
        organization: true,
        website_url: true,
        language_preference: true,
        status: true,
        created_at: true,
      },
    });

    const businessUnit =
      createDto.source === 'berry-talent-pool-page'
        ? 'Berry Virtual'
        : 'MedVirtual';
    const normalizedEmail = createDto.email.toLowerCase().trim();

    const preExistingOrg = await this.prisma.organization.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { name: { equals: sanitizedOrganization, mode: 'insensitive' } },
        ],
      },
    });

    const preExistingContact = preExistingOrg
      ? await this.prisma.contact.findFirst({
          where: { email: normalizedEmail, organization_id: preExistingOrg.id },
        })
      : null;

    // Create ticket + CRM integration (non-blocking — errors here never fail the HTTP response)
    try {
      // 1. Org — use pre-existing or create new
      let org = preExistingOrg;
      if (!org) {
        org = await this.prisma.organization.create({
          data: {
            name: sanitizedOrganization,
            website_url: sanitizedWebsiteUrl,
            business_unit: businessUnit,
            email: normalizedEmail,
            contact_first_name: sanitizedFirstName,
            contact_last_name: sanitizedLastName,
            contact_email: normalizedEmail,
            organization_role: 'prospect',
            source: 'talent-pool',
          },
        });
      }

      //console.log(org);

      // 2. Determine assignee based on environment
      let assignedUserId: string | null = null;
      const assigneeEmail =
        process.env.NODE_ENV !== 'development'
          ? 'hanieh@medvirtual.ai'
          : 'pauli@regenta.ai';

      const assignee = await this.prisma.uSER.findUnique({
        where: { email: assigneeEmail },
        select: { id: true },
      });
      if (assignee) assignedUserId = assignee.id;

      // 3. Build ticket description
      const ticketDescription = `Talent Pool Lead Information:
- Contact Name: ${sanitizedFirstName} ${sanitizedLastName}
- Email: ${normalizedEmail}
- Organization: ${sanitizedOrganization}
- Website: ${sanitizedWebsiteUrl}
- Language Preference (Bilingual EN/ES): ${createDto.language_preference}
${sanitizedMainNeed ? `- Main Need: ${sanitizedMainNeed}` : ''}
${sanitizedAdditionalDetails ? `- Additional Details: ${sanitizedAdditionalDetails}` : ''}
- Source: ${createDto.source}`;

      // 4. Create ticket linked to the org (and optionally to the selected talent pool candidate)
      const ticket = await this.prisma.ticket.create({
        data: {
          type: ticketTypeDictionary['Interview Request'] || 'interview',
          title: `Interview Request - ${sanitizedOrganization}`,
          description: ticketDescription,
          priority: Priority.medium,
          organization: { connect: { id: org.id } },
          ...(assignedUserId && { user: { connect: { id: assignedUserId } } }),
          ...(createDto.candidate_id && {
            candidate: { connect: { id: createDto.candidate_id } },
          }),
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
              role: true,
            },
          },
          organization: true,
        },
      });

      if (!ticket) {
        console.warn(
          `[talent-pool-lead] Failed to create ticket for lead ${lead.id}`,
        );
      } else {
        try {
          await this.notifications.notifyTicketEvent(ticket, 'assigned');
        } catch (err) {
          console.warn(
            `[talent-pool-lead] Failed to send notification for ticket ${ticket.id}:`,
            err?.message || err,
          );
        }
      }

      // 5. Sync Organization to HubSpot (if not already synced)
      let orgHubspotId = org.hubspot_id;
      //console.log('orgHubspotId', orgHubspotId);
      if (!orgHubspotId) {
        try {
          const hubspotOrgRes = await axios.post(
            'https://api.hubapi.com/crm/v3/objects/companies',
            {
              properties: {
                name: org.name,
                domain: org.website_url?.replaceAll('&#x2F;', '/') || '',
                business_unit: businessUnit,
                referral_email: normalizedEmail,
                type: 'PROSPECT',
              },
            },
            {
              headers: {
                Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
              },
            },
          );
          orgHubspotId = hubspotOrgRes.data.id as string;
          await this.prisma.organization.update({
            where: { id: org.id },
            data: { hubspot_id: orgHubspotId },
          });
        } catch (err) {
          const errData = err?.response?.data;
          if (errData?.category === 'CONFLICT') {
            const match = errData.message?.match(/Existing ID:\s*(\d+)/);
            if (match?.[1]) {
              orgHubspotId = match[1];
              await this.prisma.organization.update({
                where: { id: org.id },
                data: { hubspot_id: match[1] },
              });
            }
          } else {
            console.warn(
              `[talent-pool-lead] HubSpot org sync failed for lead ${lead.id}:`,
              errData || err?.message || err,
            );
          }
        }
      }

      // 6. Contact — use pre-existing or create new
      let contact = preExistingContact;
      if (!contact) {
        contact = await this.prisma.contact.create({
          data: {
            first_name: sanitizedFirstName,
            last_name: sanitizedLastName,
            email: normalizedEmail,
            organization_id: org.id,
            business_unit: businessUnit,
            company_name: sanitizedOrganization,
            website_url: sanitizedWebsiteUrl,
            referral_source: 'talent-pool',
          },
        });
      }

      // 7. Sync Contact to HubSpot (if not already synced)
      if (!contact.hubspot_id) {
        try {
          const accountType =
            businessUnit === 'Berry Virtual' ? 'Berry Virtual' : 'Med Virtual';

          let ownerEmail = '';
          if (process.env.ENVIRONMENT !== 'PROD') {
            ownerEmail = 'pauli@regenta.ai';
          } else {
            const isBerry = businessUnit === 'Berry Virtual';
            const hasCandidate = !!createDto.candidate_id;
            // if we have candidate id, we should use sales team pool, otherwise SDR pool.
            // And then pick from Berry or Med pool based on business unit
            const emailPool = hasCandidate
              ? isBerry
                ? this.salesTeamEmails_BerryVirtual
                : this.salesTeamEmails_MedVirtual
              : isBerry
                ? this.SDRTeamEmails_BerryVirtual
                : this.SDRTeamEmails_MedVirtual;

            ownerEmail =
              emailPool[Math.floor(Math.random() * emailPool.length)];
          }
          void this.notifications.notifyTalentPoolLeadNew({
            ownerEmail,
            leadName: sanitizedName,
            email: normalizedEmail,
            organization: sanitizedOrganization,
            websiteUrl: sanitizedWebsiteUrl,
            languagePreference: createDto.language_preference,
            businessUnit,
            hasCandidate: !!createDto.candidate_id,
            mainNeed: sanitizedMainNeed ?? undefined,
            additionalDetails: sanitizedAdditionalDetails ?? undefined,
          });

          //console.log('Selected HubSpot owner email:', ownerEmail);
          const ownerId = await this.getOwnerId(ownerEmail);

          const existingCandidate = await this.prisma.candidate.findUnique({
            where: { id: createDto.candidate_id || '' },
            select: {
              id: true,
              first_name: true,
              last_name: true,
              approved_positions_pairing: true,
            },
          });

          const selectedCandidateInfo = existingCandidate
            ? `Candidate: ${existingCandidate.first_name} ${existingCandidate.last_name}\nRole: ${existingCandidate.approved_positions_pairing.map((p) => p).join(', ')}`
            : '';

          const hubspotContactRes = await axios.post(
            'https://api.hubapi.com/crm/v3/objects/contacts',
            {
              properties: {
                firstname: sanitizedFirstName,
                lastname: sanitizedLastName,
                email: normalizedEmail,
                company: sanitizedOrganization,
                business_unit: businessUnit,
                account_type: accountType,
                latest_lead_source: 'Website',
                hubspot_owner_id: ownerId ? ownerId : undefined,
                ...(createDto.candidate_id
                  ? {
                      qualification_status: 'Demo Done',
                      candidate_selected: 'Yes',
                      selected_candidate_information: selectedCandidateInfo,
                    }
                  : {
                      qualification_status: 'New Leads Day 1',
                    }),
              },
              associations: orgHubspotId
                ? [
                    {
                      to: { id: orgHubspotId },
                      types: [
                        {
                          associationCategory: 'HUBSPOT_DEFINED',
                          associationTypeId: 279, // contact → company
                        },
                      ],
                    },
                  ]
                : undefined,
            },
            {
              headers: {
                Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
              },
            },
          );
          await this.prisma.contact.update({
            where: { id: contact.id },
            data: { hubspot_id: hubspotContactRes.data.id as string },
          });
        } catch (err) {
          const errData = err?.response?.data;
          if (errData?.category === 'CONFLICT') {
            const match = errData.message?.match(/Existing ID:\s*(\d+)/);
            if (match?.[1]) {
              await this.prisma.contact.update({
                where: { id: contact.id },
                data: { hubspot_id: match[1] },
              });
              if (orgHubspotId) {
                try {
                  await axios.put(
                    `https://api.hubapi.com/crm/v3/objects/contacts/${match[1]}/associations/companies/${orgHubspotId}/279`,
                    {},
                    {
                      headers: {
                        Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                        'Content-Type': 'application/json',
                      },
                    },
                  );
                } catch {
                  /* association is best-effort */
                }
              }
            }
          } else {
            console.warn(
              `[talent-pool-lead] HubSpot contact sync failed for lead ${lead.id}:`,
              errData || err?.message || err,
            );
          }
        }
      }
    } catch (error) {
      console.error(
        `[talent-pool-lead] Error in ticket/CRM flow for lead ${lead.id}:`,
        error?.message || error,
      );
    }

    return lead;
  }

  /**
   * Get all talent pool leads with pagination and filtering
   */
  async findAll(query: QueryTalentPoolLeadsDto): Promise<any> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.source) {
      where.source = query.source;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { first_name: { contains: query.search, mode: 'insensitive' } },
        { last_name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { organization: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const total = await this.prisma.talentPoolLead.count({ where });

    // Get leads
    const leads = await this.prisma.talentPoolLead.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        created_at: 'desc',
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    // Format response
    const formattedLeads = leads.map((lead) => ({
      id: lead.id,
      name: lead.name,
      first_name: lead.first_name,
      last_name: lead.last_name,
      email: lead.email,
      organization: lead.organization,
      website_url: lead.website_url,
      language_preference: lead.language_preference,
      main_need: lead.main_need,
      additional_details: lead.additional_details,
      source: lead.source,
      status: lead.status,
      assigned_to_user_id: lead.assigned_to_user_id,
      assigned_to_user: lead.assignedTo
        ? {
            id: lead.assignedTo.id,
            name: `${lead.assignedTo.first_name} ${lead.assignedTo.last_name}`,
            email: lead.assignedTo.email,
          }
        : null,
      notes: lead.notes,
      created_at: lead.created_at,
      updated_at: lead.updated_at,
      contacted_at: lead.contacted_at,
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      data: formattedLeads,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Update a talent pool lead
   */
  async update(id: string, updateDto: UpdateTalentPoolLeadDto): Promise<any> {
    // Check if lead exists
    const existingLead = await this.prisma.talentPoolLead.findUnique({
      where: { id },
    });

    if (!existingLead) {
      throw new NotFoundException('Lead not found');
    }

    // Prepare update data
    const updateData: any = {};

    if (updateDto.status !== undefined) {
      updateData.status = updateDto.status;

      // If status is being changed to 'contacted' and contacted_at is null, set it
      if (updateDto.status === 'contacted' && !existingLead.contacted_at) {
        updateData.contacted_at = new Date();
      }
    }

    if (updateDto.notes !== undefined) {
      updateData.notes = this.sanitizeInput(updateDto.notes);
    }

    if (updateDto.assigned_to_user_id !== undefined) {
      // Verify user exists if assigned
      if (updateDto.assigned_to_user_id) {
        const user = await this.prisma.uSER.findUnique({
          where: { id: updateDto.assigned_to_user_id },
        });

        if (!user) {
          throw new BadRequestException('Assigned user not found');
        }
      }
      updateData.assigned_to_user_id = updateDto.assigned_to_user_id || null;
    }

    // Update the lead
    const updatedLead = await this.prisma.talentPoolLead.update({
      where: { id },
      data: updateData,
      include: {
        assignedTo: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    return {
      id: updatedLead.id,
      status: updatedLead.status,
      notes: updatedLead.notes,
      assigned_to_user_id: updatedLead.assigned_to_user_id,
      assigned_to_user: updatedLead.assignedTo
        ? {
            id: updatedLead.assignedTo.id,
            name: `${updatedLead.assignedTo.first_name} ${updatedLead.assignedTo.last_name}`,
            email: updatedLead.assignedTo.email,
          }
        : null,
      updated_at: updatedLead.updated_at,
      contacted_at: updatedLead.contacted_at,
    };
  }

  /**
   * Basic input sanitization to prevent XSS
   */
  private sanitizeInput(input: string): string {
    if (!input) return '';
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .trim();
  }
}
