import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Body,
} from '@nestjs/common';
import axios from 'axios';

import { PrismaService } from '../prisma/prisma.service';
import {
  Organization,
  USER,
  OrganizationRole,
  OrganizationStatus,
} from '@prisma/client';
import { CreateOrganizationDto } from './dto/createOrganization.dto';
import { UpdateOrganizationDto } from './dto/updateOrganization.dto';
import { ConvertToClientDto } from './dto/convertToClient.dto';
import { GetOrganizationsDto } from './dto/getOrganizations.dto';
import {
  PaginatedOrganizationsResponseDto,
  OrganizationResponseDto,
} from './dto/organizationResponse.dto';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async getOwnerNameById(ownerId) {
    try {
      const response = await axios.get(
        `https://api.hubapi.com/crm/v3/owners/${ownerId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const owner = response.data;
      return owner.fullName || `${owner.firstName} ${owner.lastName}`;
    } catch (error) {
      console.error(
        `Erro ao buscar owner ${ownerId}:`,
        error.response?.data || error.message,
      );
      return null;
    }
  }

  async formatCompany(company) {
    const ownerIds = company.properties.hs_all_owner_ids;

    if (!ownerIds) {
      return company;
    }

    // Pode haver múltiplos IDs separados por `;`
    const ownerIdList = ownerIds.split(';');

    // Busca os nomes de todos os proprietários
    const ownerNames = await Promise.all(
      ownerIdList.map((id) => this.getOwnerNameById(id)),
    );

    // Substitui no objeto
    return {
      ...company,
      properties: {
        ...company.properties,
        hs_all_owner_names: ownerNames.filter(Boolean), // novo campo com nomes
      },
    };
  }

  async getAllFromHubspot(): Promise<any> {
    let objectOrganization;

    try {
      const result = await axios.post(
        'https://api.hubapi.com/crm/v3/objects/companies/search',
        {
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'business_unit',
                  operator: 'EQ',
                  value: 'MedVirtual',
                },
              ],
            },
          ],
          properties: [
            'agent_status',
            //'business_unit',
            'address',
            'name',
            'hs_all_assigned_business_unit_ids',
            'description',
            'domain',
            'hs_all_accessible_team_ids',
            'hs_all_owner_ids',
            'hs_all_team_ids',
          ],
          limit: 100,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const companies = result.data.results;
      const formattedCompanies = await Promise.all(
        companies.map((company) => this.formatCompany(company)),
      );

      return formattedCompanies;
    } catch (error) {
      console.error('Error fetching companies from HubSpot:', error);
      throw new Error('Failed to fetch companies from HubSpot');
    }
  }

  async getAll(user: USER): Promise<Organization[]> {
    try {
      return await this.prisma.organization.findMany({
        where: {
          OR: [
            { admin_id: user.id },
            { owner_id: user.id },
            { concierge_id: user.id },
            {
              admin_id: user.role.includes('organization')
                ? user.id
                : undefined,
            },
          ].filter(Boolean),
          status: { not: OrganizationStatus.inactive },
        },
        orderBy: {
          name: 'asc',
        },
        include: {
          owner: true,
          concierge: true,
          users: true,
        },
      });
    } catch {
      throw new NotFoundException('Organizations not found');
    }
  }

  async getAllPaginated(
    user: USER,
    query: GetOrganizationsDto,
  ): Promise<PaginatedOrganizationsResponseDto> {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        role,
        status,
        industry,
        location,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = query;

      const skip = (page - 1) * limit;

      // Build where clause
      const whereClause: any = {};

      // Add user-specific filtering for non-system admins
      if (!['system_super_admin', 'system_admin'].includes(user.role)) {
        whereClause.OR = [
          { admin_id: user.id },
          { owner_id: user.id },
          { concierge_id: user.id },
          {
            admin_id: user.role.includes('organization') ? user.id : undefined,
          },
        ].filter(Boolean);
      }

      // Add search filter
      if (search) {
        whereClause.OR = [
          ...(whereClause.OR || []),
          {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            email: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            description: {
              contains: search,
              mode: 'insensitive',
            },
          },
        ];
      }

      // Add role filter
      if (role) {
        whereClause.organization_role = role;
      }

      // Add status filter
      if (status) {
        whereClause.status = status;
      }

      // Add industry filter
      if (industry) {
        whereClause.industry = {
          contains: industry,
          mode: 'insensitive',
        };
      }

      // Add location filter
      if (location) {
        whereClause.location = {
          contains: location,
          mode: 'insensitive',
        };
      }

      // Build orderBy clause
      const orderBy: any = {};
      orderBy[sortBy] = sortOrder;

      // Get total count
      const total = await this.prisma.organization.count({
        where: whereClause,
      });

      // Get paginated results
      const organizations = await this.prisma.organization.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy,
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
              job_title: true,
              phone: true,
            },
          },
          concierge: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
              job_title: true,
              phone: true,
            },
          },
          users: {
            select: {
              id: true,
            },
          },
        },
      });

      // Transform data
      const data: OrganizationResponseDto[] = organizations.map((org) => ({
        id: org.id,
        name: org.name,
        email: org.email,
        phone: org.phone || undefined,
        website_url: org.website_url || undefined,
        location: org.location || undefined,
        description: org.description || undefined,
        industry: org.industry || undefined,
        organization_role: org.organization_role,
        number_of_employees: org.number_of_employees || undefined,
        date_founded: org.date_founded || undefined,
        date_joined: org.date_joined || undefined,
        date_became_client: org.date_became_client || undefined,
        status: org.status,
        signed_document_url: org.signed_document_url || undefined,
        signed_document_date: org.signed_document_date || undefined,
        specialties: org.specialties || undefined,
        services: org.services || undefined,
        owner_id: org.owner_id || undefined,
        concierge_id: org.concierge_id || undefined,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
        owner: org.owner || undefined,
        concierge: org.concierge || undefined,
        userCount: org.users.length,
      }));

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      return {
        data,
        meta: {
          page,
          limit,
          total,
          totalPages,
          hasNext,
          hasPrev,
        },
      };
    } catch (error) {
      throw new NotFoundException('Organizations not found');
    }
  }

  async getById(id: string): Promise<Organization> {
    try {
      const organization = await this.prisma.organization.findUnique({
        where: { id },
        include: {
          owner: true,
          concierge: true,
          users: true,
        },
      });

      if (!organization) {
        throw new NotFoundException('Organization not found');
      }

      return organization;
    } catch {
      throw new NotFoundException('Organization not found');
    }
  }

  async create(data: CreateOrganizationDto, user: USER): Promise<Organization> {
    try {
      // Check if the organization already exists
      const existingOrganization = await this.prisma.organization.findUnique({
        where: { email: data.email },
      });

      if (existingOrganization) {
        throw new BadRequestException('Organization already exists');
      }

      // Handle owner assignment based on owner_type
      let ownerId: string | undefined = undefined;
      let ownerEmail: string | undefined = undefined;

      if (data.owner_type === 'existing' && data.owner_id) {
        // Use existing user as owner
        const existingOwner = await this.prisma.uSER.findUnique({
          where: { id: data.owner_id },
        });

        if (!existingOwner) {
          throw new BadRequestException('Selected owner user not found');
        }

        // Check if user is already an owner of another organization
        if (existingOwner.is_organization_owner) {
          throw new BadRequestException(
            'User is already an owner of another organization',
          );
        }

        ownerId = existingOwner.id;
        ownerEmail = existingOwner.email;
      } else if (data.owner_type === 'new' && data.owner_email) {
        // Check if user with this email already exists
        const existingUser = await this.prisma.uSER.findUnique({
          where: { email: data.owner_email },
        });

        if (existingUser) {
          throw new BadRequestException(
            'User with this email already exists. Please select "existing" owner type.',
          );
        }

        ownerEmail = data.owner_email;
      } else if (
        data.owner_type &&
        data.owner_type !== 'existing' &&
        data.owner_type !== 'new'
      ) {
        throw new BadRequestException(
          'Invalid owner_type. Must be "existing" or "new"',
        );
      }

      // Assign a random concierge if not specified
      let conciergeId: string | undefined = data.concierge_id;
      if (!conciergeId) {
        const availableConcierges = await this.prisma.uSER.findMany({
          where: {
            role: { in: ['system_admin', 'system_super_admin'] },
            status: 'active',
          },
        });

        if (availableConcierges.length > 0) {
          // Simple round-robin assignment - could be enhanced with load balancing
          const randomIndex = Math.floor(
            Math.random() * availableConcierges.length,
          );
          conciergeId = availableConcierges[randomIndex].id;
        }
      }

      const organization = await this.prisma.organization.create({
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone,
          website_url: data.website_url,
          location: data.location,
          description: data.description,
          industry: data.industry,
          organization_role:
            data.organization_role || OrganizationRole.prospect,
          number_of_employees: data.number_of_employees,
          date_founded: data.date_founded
            ? new Date(data.date_founded)
            : undefined,
          date_joined: data.date_joined
            ? new Date(data.date_joined)
            : new Date(),
          status: data.status || OrganizationStatus.active,
          specialties: data.specialties || [],
          services: data.services || [],
          owner_id: ownerId,
          concierge_id: conciergeId,
          admin_id: user.id, // Legacy field
        },
      });

      // Handle owner creation/invitation
      if (data.owner_type === 'existing' && ownerId) {
        // Update existing user to be owner of this organization
        await this.prisma.uSER.update({
          where: { id: ownerId },
          data: {
            organization_id: organization.id,
            organization_name: organization.name,
            role: 'organization_super_admin',
            is_organization_owner: true,
          },
        });
      } else if (data.owner_type === 'new' && ownerEmail) {
        // Invite new user as owner
        const inviteData = {
          email: ownerEmail,
          role: 'organization_super_admin',
          companyName: data.name,
          organizationId: organization.id,
          first_name: data.owner_first_name || '',
          last_name: data.owner_last_name || '',
          job_title: data.owner_job_title || '',
          phone: data.owner_phone || '',
        };
        await this.auth.inviteUser(inviteData);
      }

      return organization;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create organization', error);
    }
  }

  async update(id: string, data: UpdateOrganizationDto): Promise<Organization> {
    try {
      const updateData: any = {};

      // Map the fields from DTO to database fields
      if (data.name !== undefined) updateData.name = data.name;
      if (data.email !== undefined) updateData.email = data.email;
      if (data.phone !== undefined) updateData.phone = data.phone;
      if (data.website_url !== undefined)
        updateData.website_url = data.website_url;
      if (data.location !== undefined) updateData.location = data.location;
      if (data.description !== undefined)
        updateData.description = data.description;
      if (data.industry !== undefined) updateData.industry = data.industry;
      if (data.number_of_employees !== undefined)
        updateData.number_of_employees = data.number_of_employees;
      if (data.date_founded !== undefined)
        updateData.date_founded = new Date(data.date_founded);
      if (data.date_joined !== undefined)
        updateData.date_joined = new Date(data.date_joined);
      if (data.status !== undefined) updateData.status = data.status;
      if (data.specialties !== undefined)
        updateData.specialties = data.specialties;
      if (data.services !== undefined) updateData.services = data.services;
      if (data.concierge_id !== undefined)
        updateData.concierge_id = data.concierge_id;

      return await this.prisma.organization.update({
        where: { id },
        data: updateData,
        include: {
          owner: true,
          concierge: true,
          users: true,
        },
      });
    } catch {
      throw new BadRequestException('Failed to update organization');
    }
  }

  async convertToClient(
    id: string,
    data: ConvertToClientDto,
  ): Promise<Organization> {
    try {
      const organization = await this.prisma.organization.findUnique({
        where: { id },
      });

      if (!organization) {
        throw new NotFoundException('Organization not found');
      }

      if (organization.organization_role !== OrganizationRole.prospect) {
        throw new BadRequestException('Organization is already a client');
      }

      return await this.prisma.organization.update({
        where: { id },
        data: {
          organization_role: OrganizationRole.client,
          date_became_client: new Date(),
          signed_document_url: data.signed_document_url,
          signed_document_date: data.signed_document_date
            ? new Date(data.signed_document_date)
            : new Date(),
        },
        include: {
          owner: true,
          concierge: true,
          users: true,
        },
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to convert organization to client');
    }
  }

  async assignConcierge(
    id: string,
    conciergeId: string,
  ): Promise<Organization> {
    try {
      // Verify the concierge is a system admin or super admin
      const concierge = await this.prisma.uSER.findUnique({
        where: { id: conciergeId },
      });

      if (
        !concierge ||
        !['system_admin', 'system_super_admin'].includes(concierge.role)
      ) {
        throw new BadRequestException(
          'Invalid concierge. Must be a system admin or super admin.',
        );
      }

      return await this.prisma.organization.update({
        where: { id },
        data: { concierge_id: conciergeId },
        include: {
          owner: true,
          concierge: true,
          users: true,
        },
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to assign concierge');
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.$transaction([
        this.prisma.organization.update({
          where: { id },
          data: { status: OrganizationStatus.inactive },
        }),
        this.prisma.uSER.updateMany({
          where: { organization_id: id },
          data: { status: 'inactive' },
        }),
      ]);

      return true;
    } catch {
      throw new NotFoundException('Organization not found');
    }
  }
}
