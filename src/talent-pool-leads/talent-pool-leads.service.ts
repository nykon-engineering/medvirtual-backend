import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTalentPoolLeadDto } from './dto/create-talent-pool-lead.dto';
import { UpdateTalentPoolLeadDto } from './dto/update-talent-pool-lead.dto';
import { QueryTalentPoolLeadsDto } from './dto/query-talent-pool-leads.dto';
import { Priority } from '@prisma/client';
import { ticketTypeDictionary } from '../common/dictionaries/ticket-type';

@Injectable()
export class TalentPoolLeadsService {
  constructor(private readonly prisma: PrismaService) {}

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
    const sanitizedName = this.sanitizeInput(createDto.name);
    const sanitizedOrganization = this.sanitizeInput(createDto.organization);
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
        email: createDto.email.toLowerCase().trim(),
        organization: sanitizedOrganization,
        main_need: sanitizedMainNeed,
        additional_details: sanitizedAdditionalDetails,
        source: createDto.source,
        type: 'Talent Pool Inquiry',
        status: 'new',
      },
      select: {
        id: true,
        name: true,
        email: true,
        organization: true,
        status: true,
        created_at: true,
      },
    });

    // Create an Interview Request ticket with client information
    try {
      // Try to find an existing organization by email or name
      let organizationId: string | null = null;
      
      const existingOrg = await this.prisma.organization.findFirst({
        where: {
          OR: [
            { email: createDto.email.toLowerCase().trim() },
            { name: { equals: sanitizedOrganization, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });

      if (existingOrg) {
        organizationId = existingOrg.id;
      }

      // Build ticket description with client information
      const ticketDescription = `Talent Pool Lead Information:
- Contact Name: ${sanitizedName}
- Email: ${createDto.email.toLowerCase().trim()}
- Organization: ${sanitizedOrganization}
${sanitizedMainNeed ? `- Main Need: ${sanitizedMainNeed}` : ''}
${sanitizedAdditionalDetails ? `- Additional Details: ${sanitizedAdditionalDetails}` : ''}
- Source: ${createDto.source}`;

      // Create the ticket
      const ticket = await this.prisma.ticket.create({
        data: {
          type: ticketTypeDictionary['Interview Request'] || 'interview',
          title: `Interview Request - ${sanitizedOrganization}`,
          description: ticketDescription,
          priority: Priority.medium,
          ...(organizationId && { organization: { connect: { id: organizationId } } }),
        },
      });

      // Log ticket creation (non-blocking)
      if (!ticket) {
        console.warn(`[talent-pool-lead] Failed to create ticket for lead ${lead.id}`);
      }
    } catch (error) {
      // Log error but don't fail the lead creation
      console.error(`[talent-pool-lead] Error creating ticket for lead ${lead.id}:`, error?.message || error);
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
      email: lead.email,
      organization: lead.organization,
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

