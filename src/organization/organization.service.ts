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

      // Find or create owner if owner_email is provided
      let ownerId: string | undefined = undefined;
      if (data.owner_email) {
        const owner = await this.prisma.uSER.findUnique({
          where: { email: data.owner_email },
        });
        if (owner) {
          ownerId = owner.id;
        }
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

      // If owner_email was provided but user doesn't exist, invite them
      if (data.owner_email && !ownerId) {
        const dataInvitedUser = {
          email: data.owner_email,
          role: 'organization_super_admin',
          companyName: data.name,
          organizationId: organization.id,
        };
        await this.auth.inviteUser(dataInvitedUser);
      }

      return organization;
    } catch (error) {
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
