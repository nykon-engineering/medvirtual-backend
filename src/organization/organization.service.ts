import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Body,
  Inject,
  forwardRef,
} from '@nestjs/common';
import axios from 'axios';

import { PrismaService } from '../prisma/prisma.service';
import {
  Organization,
  USER,
  OrganizationRole,
  OrganizationStatus,
  HireRequestStatus,
} from '@prisma/client';
import { CreateOrganizationDto } from './dto/createOrganization.dto';
import { UpdateOrganizationDto } from './dto/updateOrganization.dto';
import { ConvertToClientDto } from './dto/convertToClient.dto';
import { GetOrganizationsDto } from './dto/getOrganizations.dto';
import {
  PaginatedOrganizationsResponseDto,
  OrganizationResponseDto,
} from './dto/organizationResponse.dto';
import {
  GetOrganizationStaffDto,
  AdminCreateStaffDto,
} from './dto/admin-staff-management.dto';
import {
  GetCandidatesForAdminDto,
  GetHireRequestsForAdminDto,
  AdminCreateStaffWithHireRequestDto,
} from './dto/admin-staff-selection.dto';
import { AuthService } from '../auth/auth.service';
import { HubspotService } from '../hubspot/hubspot.service';
import { staffStatusDictionary } from '../common/dictionaries/staff-status-dictionary';
import { dbToStageDictionary } from '../common/dictionaries/stage-dictionary';


@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    @Inject(forwardRef (() => HubspotService))
    private readonly hubspot: HubspotService
    
  ) {}

  
  async delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  };

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

  async getDealsByCompanyId(companyId) {
    try {
      await this.delay(1000);
        const result = await axios.post(
          'https://api.hubapi.com/crm/v3/objects/deals/search',
          {
            filterGroups: [
              {
                filters: [
                  {
                    propertyName: 'hs_primary_associated_company',
                    operator: 'EQ',
                    value: `${companyId}`,
                  },
                ],
              },
            ],
            properties: [
              'amount',
              //'business_unit',
              'actual_pairing_date',
              'dealname',
            ],
            limit: 10,
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
            },
          },
        );
  
        return result.data.results;
    } catch (error) {
      console.error('Error fetching companies from HubSpot:', error);
      throw new Error('Failed to fetch companies from HubSpot');
    }
  }

  async formatCompany(company) {
    const ownerIds = company.properties.hs_all_owner_ids;

    if (!ownerIds) {
      return company;
    }

    // It can have multiples Ids separated by `;`
    const ownerIdList = ownerIds.split(';');

    // Get the name of all owners
    const ownerNames = await Promise.all(
      ownerIdList.map((id) => this.getOwnerNameById(id)),
    );

    // Get all deals associated with this company
    const deals = await this.getDealsByCompanyId(company.properties.hs_object_id);

    // Replace the object
    return {
      ...company,
      staff: deals,  
      properties: {
        ...company.properties,
        hs_all_owner_names: ownerNames.filter(Boolean), // new field with name
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
                {
                propertyName: 'num_associated_deals',
                operator: 'GT',
                value: '0',
                },
                {
                  propertyName: 'hs_object_id',
                  operator: 'EQ',
                  value: '8304831771',
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
            'hs_num_open_deals',
            'hs_total_deal_value',
            'num_associated_deals'
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
      const whereClause: any = {
        status: { not: OrganizationStatus.inactive },
      };

      // For system_super_admin: return all organizations
      if (user.role === 'system_super_admin') {
        // No additional filtering needed - return all active organizations
      }
      // For system_admin: return only organizations they are admin or concierge of
      else if (user.role === 'system_admin') {
        whereClause.OR = [{ admin_id: user.id }];
      }
      // For organization users: return organizations they are associated with
      else {
        whereClause.OR = [
          { admin_id: user.id },
          { owner_id: user.id },
          { admin_id: user.id },
          {
            admin_id: user.role.includes('organization') ? user.id : undefined,
          },
        ].filter(Boolean);
      }

      return await this.prisma.organization.findMany({
        where: whereClause,
        orderBy: {
          name: 'asc',
        },
        include: {
          owner: true,
          admin: true,
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
        admin,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = query;

      const skip = (page - 1) * limit;

      // Build where clause
      const whereClause: any = {};

      // Add user-specific filtering based on role
      if (user.role === 'system_super_admin') {
        // No additional filtering needed - return all organizations
      } else if (user.role === 'system_admin') {
        // For system_admin: return only organizations they are admin or concierge of
        whereClause.OR = [{ admin_id: user.id }];
      } else {
        // For organization users: return organizations they are associated with
        whereClause.OR = [
          { admin_id: user.id },
          { owner_id: user.id },
          { admin_id: user.id },
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

      // Add admin filter (only for system_super_admin)
      if (admin && user.role === 'system_super_admin') {
        whereClause.admin_id = admin;
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
          admin: {
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
        hubspot_id: org.hubspot_id || undefined,
        name: org.name,
        email: org.email || undefined,
        phone: org.phone || undefined,
        website_url: org.website_url || undefined,
        address: org.address || undefined,
        city: org.city || undefined,
        state: org.state || undefined,
        postal_code: org.postal_code || undefined,
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
        admin_id: org.admin_id || undefined,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
        owner: org.owner || undefined,
        admin: org.admin || undefined,
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
          admin: true,
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

  async create(data: CreateOrganizationDto): Promise<Organization> {
    try {
      // // Check if the organization already exists
      // const existingOrganization = await this.prisma.organization.findUnique({
      //   where: { email: data.email },
      // });

      // if (existingOrganization) {
      //   throw new BadRequestException('Organization already exists');
      // }

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

      // Assign a random admin if not specified
      let adminId: string | undefined = data.admin_id;
      if (!adminId) {
        const availableAdmins = await this.prisma.uSER.findMany({
          where: {
            id: '111a7e30-e5e7-4ac6-a75e-41e70853bd04', // Added one 2025-09-25 for get Hanieh as default concierge for all organizations via hubspot. asked by Pauli
            role: { in: ['system_admin', 'system_super_admin'] },
            status: 'active',
          },
        });

        if (availableAdmins.length > 0) {
          // Simple round-robin assignment - could be enhanced with load balancing
          const randomIndex = Math.floor(
            Math.random() * availableAdmins.length,
          );
          adminId = availableAdmins[randomIndex].id;
        }
      }
      let specialtiesArray: string[] = [];
      let servicesArray: string[] = [];
      if(typeof data.specialties === 'string'){
        specialtiesArray = data.specialties.split(',').map(s => s.trim());
      }else if (Array.isArray(data.specialties)) {
        specialtiesArray = data.specialties;
      }else{
        specialtiesArray = [];
      }

      if(typeof data.services === 'string'){
        servicesArray = data.services.split(',').map(s => s.trim());
      }else if (Array.isArray(data.services)) {
        servicesArray = data.services;
      }else{
        servicesArray = [];
      }


      const organization = await this.prisma.organization.create({
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone,
          website_url: data.website_url,
          address: data.address,
          city: data.city,
          state: data.state,
          postal_code: data.zip,
          location: data.location,
          description: data.description,
          industry: data.industry,
          organization_role:
            data.organization_role || OrganizationRole.prospect,
          number_of_employees: Number(data.number_of_employees),
          date_founded: data.date_founded
            ? new Date(data.date_founded)
            : undefined,
          date_joined: data.date_joined
            ? new Date(data.date_joined)
            : new Date(),
          status: data.status || OrganizationStatus.active,
          specialties: specialtiesArray,
          services: servicesArray,
          owner_id: ownerId,
          admin_id: adminId,
          hubspot_id: data.hubspot_id || undefined,
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
      console.log('Failed to create a organization: ', error);
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

      // Fix number_of_employees validation
      if (data.number_of_employees !== undefined) {
        // Ensure it's a valid integer
        const numEmployees = parseInt(data.number_of_employees.toString(), 10);
        if (isNaN(numEmployees) || numEmployees < 1) {
          throw new BadRequestException(
            'Number of employees must be a valid positive integer',
          );
        }
        updateData.number_of_employees = numEmployees;
      }
      if (data.date_founded !== undefined && data.date_founded !== '')
        updateData.date_founded = new Date(data.date_founded);
      if (data.date_joined !== undefined)
        updateData.date_joined = new Date(data.date_joined);
      if (data.status !== undefined) updateData.status = data.status;
      if (data.specialties !== undefined)
        updateData.specialties = data.specialties;
      if (data.services !== undefined) updateData.services = data.services;
      if (data.admin_id !== undefined)
        updateData.admin_id = data.admin_id;

      // Handle organization_role update
      if (data.organization_role !== undefined) {
        updateData.organization_role = data.organization_role;
      }

      // Handle signed_document_url update
      if (data.signed_document_url !== undefined) {
        updateData.signed_document_url = data.signed_document_url;
        // Update the signed document date when URL is provided
        updateData.signed_document_date = new Date();
      }

      return await this.prisma.organization.update({
        where: { id },
        data: updateData,
        include: {
          owner: true,
          admin: true,
          users: true,
        },
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to update organization');
    }
  }

  async convertToClient(
    id: string,
    data: ConvertToClientDto,
  ): Promise<any> {
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

      //transaction to handle the updates
      const updates = await this.prisma.$transaction(async (up) => {
        await up.organization.update({
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
            admin: true,
            users: true,
          },
        }),

        await up.hireRequest.updateMany({
          where: {
            org_id: id,
            status: HireRequestStatus.pending_signature,
          },
          data: {
            status: HireRequestStatus.new
          },
        })

      })

      return await this.prisma.organization.findUnique({
        where: { id },
        include: {
          owner: true,
          admin: true,
          users: true,
        },
      })

    } catch (error) {
      console.log(error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to convert organization to client', error);
    }
  }

  async assignAdmin(
    id: string,
    adminId: string,
  ): Promise<Organization> {
    try {
      // Verify the admin is a system admin or super admin
      const admin = await this.prisma.uSER.findUnique({
        where: { id: adminId },
      });

      if (
        !admin ||
        !['system_admin', 'system_super_admin'].includes(admin.role)
      ) {
        throw new BadRequestException(
          'Invalid admin. Must be a system admin or super admin.',
        );
      }

      return await this.prisma.organization.update({
        where: { id },
        data: { admin_id: adminId },
        include: {
          owner: true,
          admin: true,
          users: true,
        },
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to assign admin');
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

  // Admin Staff Management Methods
  async getOrganizationStaff(
    organizationId: string,
    query: GetOrganizationStaffDto,
    _user: USER,
  ): Promise<any> {
    try {
      // Verify organization exists
      const organization = await this.prisma.organization.findUnique({
        where: { id: organizationId },
      });

      if (!organization) {
        throw new NotFoundException('Organization not found');
      }

      const {
        page = 1,
        perPage = 10,
        search,
        start_date_from,
        start_date_to,
        status,
      } = query;

      const skip = (page - 1) * perPage;
      const take = perPage;

      const where: any = {
        hireRequest: {
          org_id: organizationId,
        },
        candidate: {},
      };

      if (search) {
        where.OR = [
          {
            hireRequest: {
              title: { contains: search, mode: 'insensitive' },
            },
          },
          {
            candidate: {
              first_name: { contains: search, mode: 'insensitive' },
            },
          },
          {
            candidate: {
              last_name: { contains: search, mode: 'insensitive' },
            },
          },
        ];
      }

      if (start_date_from || start_date_to) {
        where.start_date = {};
        if (start_date_from) where.start_date.gte = new Date(start_date_from);
        if (start_date_to) where.start_date.lte = new Date(start_date_to);
      }

      if (status) {
        // Convert frontend status to database status using the dictionary
        const dbStatus = staffStatusDictionary[status];
        if (dbStatus) {
          where.status = dbStatus;
        }
      }

      const select = {
        id: true,
        hirerequest_id: true,
        status: true,
        salary: true,
        start_date: true,
        created_at: true,
        updated_at: true,
        hubspot_id: true,
        candidate: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            specialization: true,
            employment_type: true,
            country: true,
            about_me: true,
            languages: {
              select: {
                name: true,
              },
            },
            skills: {
              select: {
                skill_name: true,
              },
            },
            createdAt: true,
          },
        },
        hireRequest: {
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            priority: true,
            availability: true,
            contract_length: true,
            expected_start_date: true,
            salary_range_from: true,
            salary_range_to: true,
            specialization: true,
            location: true,
          },
        },
        bonus: {
          select: {
            id: true,
            amount: true,
            description: true,
            created_at: true,
            created_by: true,
          },
        },
      };

      const [staff, total] = await this.prisma.$transaction([
        this.prisma.staff.findMany({
          where,
          skip,
          take,
          select,
        }),
        this.prisma.staff.count({ where }),
      ]);

      return {
        status: 200,
        data: staff,
        meta: {
          total,
          page,
          perPage,
          totalPages: Math.ceil(Number(total) / perPage),
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch organization staff');
    }
  }

  async createStaffForOrganization(
    data: AdminCreateStaffDto,
    user: USER,
  ): Promise<any> {
    try {
      // Verify organization exists
      const organization = await this.prisma.organization.findUnique({
        where: { id: data.organization_id },
      });

      if (!organization) {
        throw new NotFoundException('Organization not found');
      }

      // Verify hire request belongs to the organization
      const hireRequest = await this.prisma.hireRequest.findFirst({
        where: {
          id: data.hirerequest_id,
          org_id: data.organization_id,
        },
      });

      if (!hireRequest) {
        throw new BadRequestException(
          'Hire request not found or does not belong to the specified organization',
        );
      }

      // Verify candidate exists
      const candidate = await this.prisma.candidate.findUnique({
        where: { id: data.candidate_id },
      });

      if (!candidate) {
        throw new NotFoundException('Candidate not found');
      }

      const statusHandled = staffStatusDictionary[data.status];

      const staff = await this.prisma.staff.create({
        data: {
          candidate_id: data.candidate_id,
          hirerequest_id: data.hirerequest_id,
          status: statusHandled,
          salary: data.salary,
          start_date: data.start_date,
          created_by: user.id,
        },
      });

      // Get the created staff with all relations
      const createdStaff = await this.prisma.staff.findUnique({
        where: { id: staff.id },
        select: {
          id: true,
          hirerequest_id: true,
          status: true,
          salary: true,
          start_date: true,
          created_at: true,
          updated_at: true,
          candidate: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              specialization: true,
              employment_type: true,
              country: true,
              about_me: true,
              languages: {
                select: {
                  name: true,
                },
              },
              skills: {
                select: {
                  skill_name: true,
                },
              },
              createdAt: true,
            },
          },
          hireRequest: {
            select: {
              id: true,
              title: true,
              description: true,
              status: true,
              priority: true,
              availability: true,
              contract_length: true,
              expected_start_date: true,
              salary_range_from: true,
              salary_range_to: true,
              specialization: true,
              location: true,
            },
          },
          bonus: {
            select: {
              id: true,
              amount: true,
              description: true,
              created_at: true,
              created_by: true,
            },
          },
        },
      });

      return {
        status: 201,
        message: 'Staff created successfully for organization',
        data: createdStaff,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to create staff for organization');
    }
  }

  // Admin Selection Methods
  async getCandidatesForHireRequest(
    hireRequestId: string,
    query: GetCandidatesForAdminDto,
  ): Promise<any> {
    try {
      // Verify hire request exists
      const hireRequest = await this.prisma.hireRequest.findUnique({
        where: { id: hireRequestId },
        select: { id: true, title: true, org_id: true },
      });

      if (!hireRequest) {
        throw new NotFoundException('Hire request not found');
      }

      const {
        page = 1,
        perPage = 20,
        search,
        specialization,
        employment_type,
        country,
      } = query;

      const skip = (page - 1) * perPage;
      const take = perPage;

      // First check if there are any candidates attached to this hire request
      const attachedCandidatesCount = await this.prisma.candidate.count({
        where: {
          pipeline_status: 'available',
          panelCandidates: {
            some: {
              panel: {
                hire_request_id: hireRequestId,
              },
            },
          },
        },
      });

      // Build where clause - if no attached candidates, get all available candidates
      const where: any = {
        pipeline_status: 'available',
      };

      // Only filter by panelCandidates if there are attached candidates
      if (attachedCandidatesCount > 0) {
        where.panelCandidates = {
          some: {
            panel: {
              hire_request_id: hireRequestId,
            },
          },
        };
      }

      if (search) {
        where.OR = [
          {
            first_name: { contains: search, mode: 'insensitive' },
          },
          {
            last_name: { contains: search, mode: 'insensitive' },
          },
          {
            email: { contains: search, mode: 'insensitive' },
          },
        ];
      }

      if (specialization) {
        where.specialization = {
          contains: specialization,
          mode: 'insensitive',
        };
      }

      if (employment_type) {
        where.employment_type = employment_type;
      }

      if (country) {
        where.country = { contains: country, mode: 'insensitive' };
      }

      const select = {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        specialization: true,
        employment_type: true,
        country: true,
        about_me: true,
        languages: {
          select: {
            name: true,
          },
        },
        skills: {
          select: {
            skill_name: true,
          },
        },
        createdAt: true,
        panelCandidates: {
          where: {
            panel: {
              hire_request_id: hireRequestId,
            },
          },
          select: {
            status: true,
            panel: {
              select: {
                id: true,
                status: true,
                scheduled_date: true,
              },
            },
          },
        },
      };

      const [candidates, total] = await this.prisma.$transaction([
        this.prisma.candidate.findMany({
          where,
          skip,
          take,
          select,
          orderBy: {
            createdAt: 'desc',
          },
        }),
        this.prisma.candidate.count({ where }),
      ]);

      return {
        status: 200,
        data: candidates,
        hireRequest: {
          id: hireRequest.id,
          title: hireRequest.title,
        },
        hasAttachedCandidates: attachedCandidatesCount > 0,
        meta: {
          total,
          page,
          perPage,
          totalPages: Math.ceil(Number(total) / perPage),
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to fetch candidates for hire request',
      );
    }
  }

  async getCandidatesForAdmin(query: GetCandidatesForAdminDto): Promise<any> {
    try {
      const {
        page = 1,
        perPage = 20,
        search,
        specialization,
        employment_type,
        country,
      } = query;

      const skip = (page - 1) * perPage;
      const take = perPage;

      const where: any = {
        pipeline_status: 'available', // Only available candidates
      };

      if (search) {
        where.OR = [
          {
            first_name: { contains: search, mode: 'insensitive' },
          },
          {
            last_name: { contains: search, mode: 'insensitive' },
          },
          {
            email: { contains: search, mode: 'insensitive' },
          },
        ];
      }

      if (specialization) {
        where.specialization = {
          contains: specialization,
          mode: 'insensitive',
        };
      }

      if (employment_type) {
        where.employment_type = employment_type;
      }

      if (country) {
        where.country = { contains: country, mode: 'insensitive' };
      }

      const select = {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        specialization: true,
        employment_type: true,
        country: true,
        about_me: true,
        languages: {
          select: {
            name: true,
          },
        },
        skills: {
          select: {
            skill_name: true,
          },
        },
        createdAt: true,
      };

      const [candidates, total] = await this.prisma.$transaction([
        this.prisma.candidate.findMany({
          where,
          skip,
          take,
          select,
          orderBy: {
            createdAt: 'desc',
          },
        }),
        this.prisma.candidate.count({ where }),
      ]);

      return {
        status: 200,
        data: candidates,
        meta: {
          total,
          page,
          perPage,
          totalPages: Math.ceil(Number(total) / perPage),
        },
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch candidates');
    }
  }

  async getHireRequestDetails(hireRequestId: string): Promise<any> {
    try {
      // Get hire request with attached candidates
      const hireRequest = await this.prisma.hireRequest.findUnique({
        where: { id: hireRequestId },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          specialization: true,
          location: true,
          availability: true,
          contract_length: true,
          expected_start_date: true,
          salary_range_from: true,
          salary_range_to: true,
          createdAt: true,
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
          panels: {
            select: {
              id: true,
              status: true,
              scheduled_date: true,
              createdAt: true,
              panelCandidates: {
                select: {
                  id: true,
                  status: true,
                  createdAt: true,
                  candidate: {
                    select: {
                      id: true,
                      first_name: true,
                      last_name: true,
                      email: true,
                      specialization: true,
                      employment_type: true,
                      country: true,
                      about_me: true,
                      languages: {
                        select: {
                          name: true,
                        },
                      },
                      skills: {
                        select: {
                          skill_name: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!hireRequest) {
        throw new NotFoundException('Hire request not found');
      }

      // Extract all candidates from panels
      const attachedCandidates = hireRequest.panels.flatMap((panel) =>
        panel.panelCandidates.map((pc) => ({
          ...pc.candidate,
          panelStatus: pc.status,
          panelId: panel.id,
          panelScheduledDate: panel.scheduled_date,
        })),
      );

      const candidates = await this.prisma.candidate.findMany({
        where: {
          pipeline_status: {
            in: ['261075105', '1087596819'],
          },
        },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          specialization: true,
          employment_type: true,
          country: true,
          about_me: true,
          languages: {
            select: { name: true },
          },
          skills: {
            select: { skill_name: true },
          },
        },
      });

      const mappedPipelineCandidates = candidates.map((c) => ({
        ...c,
        panelStatus: null, //just for align with the preious structure
        panelId: null,
        panelScheduledDate: null,
      }));
      
      //just for merge candidates and return all candidates
      const allCandidates = [...attachedCandidates, ...mappedPipelineCandidates];


      return {
        status: 200,
        data: {
          hireRequest: {
            id: hireRequest.id,
            title: hireRequest.title,
            description: hireRequest.description,
            status: hireRequest.status,
            priority: hireRequest.priority,
            specialization: hireRequest.specialization,
            location: hireRequest.location,
            availability: hireRequest.availability,
            contract_length: hireRequest.contract_length,
            expected_start_date: hireRequest.expected_start_date,
            salary_range_from: hireRequest.salary_range_from,
            salary_range_to: hireRequest.salary_range_to,
            createdAt: hireRequest.createdAt,
            organization: hireRequest.organization,
          },
          attachedCandidates: allCandidates,
          hasAttachedCandidates: attachedCandidates.length > 0,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch hire request details');
    }
  }

  async getHireRequestsForAdmin(
    organizationId: string,
    query: GetHireRequestsForAdminDto,
  ): Promise<any> {
    try {
      // Verify organization exists
      const organization = await this.prisma.organization.findUnique({
        where: { id: organizationId },
      });

      if (!organization) {
        throw new NotFoundException('Organization not found');
      }

      const { page = 1, perPage = 20, search, status, specialization } = query;

      const skip = (page - 1) * perPage;
      const take = perPage;

      const where: any = {
        org_id: organizationId,
      };

      if (search) {
        where.title = { contains: search, mode: 'insensitive' };
      }

      if (status) {
        where.status = status;
      }

      if (specialization) {
        where.specialization = {
          contains: specialization,
          mode: 'insensitive',
        };
      }

      const select = {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        specialization: true,
        location: true,
        availability: true,
        contract_length: true,
        expected_start_date: true,
        salary_range_from: true,
        salary_range_to: true,
        createdAt: true,
      };

      const [hireRequests, total] = await this.prisma.$transaction([
        this.prisma.hireRequest.findMany({
          where,
          skip,
          take,
          select,
          orderBy: {
            createdAt: 'desc',
          },
        }),
        this.prisma.hireRequest.count({ where }),
      ]);

      return {
        status: 200,
        data: hireRequests,
        meta: {
          total,
          page,
          perPage,
          totalPages: Math.ceil(Number(total) / perPage),
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch hire requests');
    }
  }

  async createStaffWithOptionalHireRequest(
    data: AdminCreateStaffWithHireRequestDto,
    user: USER,
  ): Promise<any> {
    try {
      // Verify organization exists
      const organization = await this.prisma.organization.findUnique({
        where: { id: data.organization_id },
      });

      if (!organization) {
        throw new NotFoundException('Organization not found');
      }

      // Verify candidate exists
      const candidate = await this.prisma.candidate.findUnique({
        where: { id: data.candidate_id },
      });

      if (!candidate) {
        throw new NotFoundException('Candidate not found');
      }

      let hireRequestId = data.hirerequest_id;

      // If no hire request ID provided, create a new hire request
      if (!hireRequestId) {
        if (!data.hire_request_title) {
          throw new BadRequestException(
            'Hire request title is required when creating a new hire request',
          );
        }

        const newHireRequest = await this.prisma.hireRequest.create({
          data: {
            org_id: data.organization_id,
            title: data.hire_request_title,
            description: data.hire_request_description || '',
            status: 'placement_completed', // Mark as completed since we're creating staff
            priority: data.hire_request_priority || 'medium',
            specialization:
              data.hire_request_specialization ||
              candidate.specialization ||
              '',
            location: data.hire_request_location || '',
            availability: data.hire_request_availability || 'immediate',
            contract_length: data.hire_request_contract_length || '',
            expected_start_date:
              data.hire_request_expected_start_date || data.start_date,
            salary_range_from:
              data.hire_request_salary_range_from || data.salary,
            salary_range_to: data.hire_request_salary_range_to || data.salary,
          },
        });

        hireRequestId = newHireRequest.id;
      } else {
        // Verify existing hire request belongs to the organization
        const existingHireRequest = await this.prisma.hireRequest.findFirst({
          where: {
            id: hireRequestId,
            org_id: data.organization_id,
          },
        });

        if (!existingHireRequest) {
          throw new BadRequestException(
            'Hire request not found or does not belong to the specified organization',
          );
        }
      }

      const statusHandled = staffStatusDictionary[data.status];

      const pipelineStatus = Object.keys(dbToStageDictionary).find(key => {
        return dbToStageDictionary[key] === 'Hired';
      })
      if (!pipelineStatus) throw new NotFoundException(`Pipeline status not found for Hired`);
      await this.hubspot.updateOneCandidateFromHireRequest(candidate.hubspot_id, pipelineStatus);

      const pipelineStatusLosers = Object.keys(dbToStageDictionary).find(key => {
        return dbToStageDictionary[key] === 'Available Candidates';
      })
      if (!pipelineStatusLosers) throw new NotFoundException(`Pipeline status not found for Available Candidates`);



      // Create staff and record candidate as winner in a transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Create the staff record
        const staff = await tx.staff.create({
          data: {
            candidate_id: data.candidate_id,
            hirerequest_id: hireRequestId,
            status: statusHandled,
            salary: data.salary,
            start_date: data.start_date,
            created_by: user.id,
          },
        });

        // Record candidate as winner for the hire request
        // First, check if there are any panels for this hire request
        const panels = await tx.candidatePanel.findMany({
          where: { hire_request_id: hireRequestId },
          select: { id: true },
        });
        console.log('panels', panels);
        if (panels.length > 0) {
          
          // Update panel candidates to mark this candidate as winnee
          await tx.panelCandidate.updateMany({
            where: {
              panel_id: { in: panels.map((p) => p.id) },
              candidate_id: data.candidate_id,
            },
            data: {
              status: 'selected_by_client',
            },
          });
          await tx.candidate.update({
            where: { id: candidate.id },
            data: { pipeline_status: pipelineStatus },
          })
          



          
          
          
          // Mark other candidates as returned to pool
          await tx.panelCandidate.updateMany({
            where: {
              panel_id: { in: panels.map((p) => p.id) },
              candidate_id: { not: data.candidate_id },
            },
            data: {
              status: 'returned_to_pool',
            },
          });

          
      
          const loserExists = await tx.panelCandidate.findMany({
            where: {
              panel_id: { in: panels.map((p) => p.id) },
              NOT: {
                candidate_id: candidate.id,
              },
            },
            select: {
              id: true,
              candidate:{
                select: {
                  id: true,
                  hubspot_id: true,
                  pipeline_status_origin: true
                },
              },
            },
          });
          console.log('loserExists', loserExists);
          const candidateLosers = loserExists.map(c => c.candidate);
          await Promise.all(
            candidateLosers.map(async c =>{
              const  pipeline_treated = c.pipeline_status_origin || pipelineStatusLosers;
              await this.prisma.candidate.update({
                where: { id: c.id },
                data: { pipeline_status: pipeline_treated},
              });
              await this.hubspot.updateOneCandidateFromHireRequest(c.hubspot_id, pipeline_treated);
            }
            )
          );

         



          // Update panel status to decision_made
          await tx.candidatePanel.updateMany({
            where: { hire_request_id: hireRequestId },
            data: { status: 'decision_made' },
          });
        }

        // Update hire request status to placement_completed
        await tx.hireRequest.update({
          where: { id: hireRequestId },
          data: { status: 'placement_completed' },
        });

        return staff;
      });
      
      


      const staff = result;

      // Get the created staff with all relations
      const createdStaff = await this.prisma.staff.findUnique({
        where: { id: staff.id },
        select: {
          id: true,
          hirerequest_id: true,
          status: true,
          salary: true,
          start_date: true,
          created_at: true,
          updated_at: true,
          candidate: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              specialization: true,
              employment_type: true,
              country: true,
              about_me: true,
              languages: {
                select: {
                  name: true,
                },
              },
              skills: {
                select: {
                  skill_name: true,
                },
              },
              createdAt: true,
            },
          },
          hireRequest: {
            select: {
              id: true,
              title: true,
              description: true,
              status: true,
              priority: true,
              availability: true,
              contract_length: true,
              expected_start_date: true,
              salary_range_from: true,
              salary_range_to: true,
              specialization: true,
              location: true,
            },
          },
          bonus: {
            select: {
              id: true,
              amount: true,
              description: true,
              created_at: true,
              created_by: true,
            },
          },
        },
      });

      return {
        status: 201,
        message: 'Staff created successfully for organization',
        data: createdStaff,
      };
    } catch (error) {
      console.log('error', error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to create staff for organization');
    }
  }
}
