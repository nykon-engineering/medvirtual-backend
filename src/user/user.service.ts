import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, USER } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { UpdateProfileDto } from './dto/updateProfile.dto';
import { GetProfileDto } from './dto/getProfile.dto';
import { SearchUsersDto } from './dto/searchUsers.dto';
import InviteSignup from '../common/utils/email-templates/invite-signup';
import { InviteUserToOrganizationDto } from './dto/inviteUserToOrganization.dto';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async create(userData: Prisma.USERUncheckedCreateInput): Promise<USER> {
    const { password, ...rest } = userData;
    const hash = await bcrypt.hash(password, 10);

    const newUserData = {
      ...rest,
      password: hash,
      // Set default creation tracking if not provided
      createdByMethod: rest.createdByMethod || 'self_signup',
      createdByUserId: rest.createdByUserId || null,
    };

    const newUser = await this.prisma.uSER.create({
      data: newUserData,
    });
    return newUser;
  }

  async findByEmail(email: string): Promise<USER | null> {
    return this.prisma.uSER.findUnique({
      where: { email },
    });
  }

  async findById(id: string): Promise<USER | null> {
    const user = await this.prisma.uSER.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`User not found`);
    }
    return user;
  }

  async findByOrganizationId(organizationId: string): Promise<any> {
    const users = await this.prisma.uSER.findMany({
      where: { organization_id: organizationId },
      select: {
        id: true,
        email: true,
        organization_id: true,
        organization_name: true,
        first_name: true,
        last_name: true,
        phone: true,
        avatar: true,
        job_title: true,
        role: true,
        workos_id: true,
        authentication_method: true,
        status: true,
        verified: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!users || users.length === 0) {
      throw new NotFoundException(`No users found in this organization.`);
    }

    return users;
  }

  async findUsersByOrganizationByCurrentUser(user: USER): Promise<any> {
    let whereClause: any = {};

    // If user is system_admin, only return users from organizations they admin
    if (user.role === 'system_admin') {
      // Find organizations where this user is the admin
      const adminOrganizations = await this.prisma.organization.findMany({
        where: { admin_id: user.id },
        select: { id: true },
      });

      const organizationIds = adminOrganizations.map((org) => org.id);

      if (organizationIds.length === 0) {
        throw new NotFoundException(
          `No organizations found where you are the admin.`,
        );
      }

      whereClause = { organization_id: { in: organizationIds } };
    } else if (user.role === 'system_super_admin') {
      // system_super_admin can see all users from all organizations | here I need to retrieve just users without organization it means 'system super admins'
      whereClause = { organization_id: null };
    } else {
      // Fallback to original behavior for other roles
      whereClause = { organization_id: user.organization_id };
    }

    const users = await this.prisma.uSER.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        organization_id: true,
        organization_name: true,
        first_name: true,
        last_name: true,
        job_title: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    if (!users || users.length === 0) {
      throw new NotFoundException(
        `No users found in the accessible organizations.`,
      );
    }

    return users;
  }

  async getProfileById(id: string): Promise<GetProfileDto> {
    const user = await this.prisma.uSER.findUnique({
      where: { id },
      include: {
        organization: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User not found`);
    }

    // Transform to GetProfileDto format
    const profileResponse: GetProfileDto = {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      avatar: user.avatar,
      job_title: user.job_title,
      role: user.role,
      status: user.status,
      verified: user.verified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      organization: user.organization
        ? {
            id: user.organization.id,
            name: user.organization.name,
            email: user.organization.email || undefined,
            phone: user.organization.phone || undefined,
            website_url: user.organization.website_url || undefined,
            location: user.organization.location || undefined,
            status: user.organization.status,
            organization_role: user.organization.organization_role,
            specialties: user.organization.specialties || undefined,
            services: user.organization.services || undefined,
            description: user.organization.description || undefined,
            industry: user.organization.industry || undefined,
            number_of_employees:
              user.organization.number_of_employees || undefined,
            createdAt: user.organization.createdAt,
            updatedAt: user.organization.updatedAt,
          }
        : undefined,
    };

    return profileResponse;
  }

  async getCurrentUserProfile(userId: string): Promise<GetProfileDto> {
    return this.getProfileById(userId);
  }

  async updateProfile(
    id: string,
    profileData: UpdateProfileDto,
  ): Promise<GetProfileDto> {
    try {
      const currentUser = await this.findById(id);
      if (!currentUser) {
        throw new NotFoundException(`User not found`);
      }

      // Separate user fields from organization fields
      const {
        organization_name,
        organization_description,
        organization_website_url,
        organization_industry,
        organization_number_of_employees,
        organization_location,
        organization_date_founded,
        organization_specialties,
        organization_role,
        signed_document_url,
        ...userFields
      } = profileData;

      // Filter out undefined values from user fields to avoid Prisma errors
      const filteredUserFields = Object.fromEntries(
        Object.entries(userFields).filter(([, value]) => value !== undefined),
      );

      // Handle organization updates if organization fields are provided
      const organizationFields = {
        organization_name,
        organization_description,
        organization_website_url,
        organization_industry,
        organization_number_of_employees,
        organization_location,
        organization_date_founded,
        organization_specialties,
        organization_role,
        signed_document_url,
      };

      // Check if any organization fields are provided (including null/empty values for clearing)
      const hasOrganizationFields = Object.values(organizationFields).some(
        (value) => value !== undefined,
      );

      if (hasOrganizationFields && currentUser.organization_id) {
        // Prepare organization update data
        const organizationUpdateData: Prisma.OrganizationUpdateInput = {};

        if (organization_name !== undefined) {
          if (organization_name.trim() !== '') {
            organizationUpdateData.name = organization_name;
          }
        }
        if (organization_description !== undefined) {
          organizationUpdateData.description = organization_description || null;
        }
        if (organization_website_url !== undefined) {
          organizationUpdateData.website_url = organization_website_url || null;
        }
        if (organization_industry !== undefined) {
          organizationUpdateData.industry = organization_industry || null;
        }
        if (organization_number_of_employees !== undefined) {
          if (
            organization_number_of_employees === null ||
            organization_number_of_employees === 0
          ) {
            organizationUpdateData.number_of_employees = null;
          } else {
            // Ensure it's a valid integer
            const numEmployees = parseInt(
              organization_number_of_employees.toString(),
              10,
            );
            if (isNaN(numEmployees) || numEmployees < 1) {
              throw new BadRequestException(
                'Number of employees must be a valid positive integer',
              );
            }
            organizationUpdateData.number_of_employees = numEmployees;
          }
        }
        if (organization_location !== undefined) {
          organizationUpdateData.location = organization_location || null;
        }
        if (organization_date_founded !== undefined) {
          if (
            organization_date_founded === null ||
            organization_date_founded === ''
          ) {
            organizationUpdateData.date_founded = null;
          } else {
            organizationUpdateData.date_founded = new Date(
              organization_date_founded,
            );
          }
        }
        if (organization_specialties !== undefined) {
          if (
            organization_specialties === null ||
            organization_specialties === ''
          ) {
            organizationUpdateData.specialties = { set: [] };
          } else {
            // Convert comma-separated string to array
            const specialtiesArray = organization_specialties
              .split(',')
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
            organizationUpdateData.specialties = { set: specialtiesArray };
          }
        }
        if (organization_role !== undefined) {
          organizationUpdateData.organization_role = organization_role;
        }
        if (signed_document_url !== undefined) {
          organizationUpdateData.signed_document_url =
            signed_document_url || null;
        }

        // Update organization
        await this.prisma.organization.update({
          where: { id: currentUser.organization_id },
          data: organizationUpdateData,
        });
      }

      // Update user fields
      const updatedUser = await this.prisma.uSER.update({
        where: { id },
        data: filteredUserFields,
        include: {
          organization: true,
        },
      });

      // Transform to GetProfileDto format
      const profileResponse: GetProfileDto = {
        id: updatedUser.id,
        email: updatedUser.email,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        phone: updatedUser.phone,
        avatar: updatedUser.avatar,
        job_title: updatedUser.job_title,
        role: updatedUser.role,
        status: updatedUser.status,
        verified: updatedUser.verified,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
        organization: updatedUser.organization
          ? {
              id: updatedUser.organization.id,
              name: updatedUser.organization.name,
              email: updatedUser.organization.email || undefined,
              phone: updatedUser.organization.phone || undefined,
              website_url: updatedUser.organization.website_url || undefined,
              location: updatedUser.organization.location || undefined,
              status: updatedUser.organization.status,
              organization_role: updatedUser.organization.organization_role,
              specialties: updatedUser.organization.specialties || undefined,
              services: updatedUser.organization.services || undefined,
              description: updatedUser.organization.description || undefined,
              industry: updatedUser.organization.industry || undefined,
              number_of_employees:
                updatedUser.organization.number_of_employees || undefined,
              createdAt: updatedUser.organization.createdAt,
              updatedAt: updatedUser.organization.updatedAt,
            }
          : undefined,
      };

      return profileResponse;
    } catch (error) {
      throw new BadRequestException(`Failed to update profile: ${error}`);
    }
  }

  async update(id: string, userData: Prisma.USERUpdateInput): Promise<USER> {
    try {
      let user: Prisma.USERUpdateInput;
      const currentUser = await this.findById(id);
      if (!currentUser) {
        throw new NotFoundException(`User not found`);
      }

      //verify user to update status
      if (
        userData.job_title &&
        userData.organization_name &&
        currentUser.status === 'incomplete'
      ) {
        user = { ...userData, status: 'active' };
      } else {
        user = { ...userData };
      }
      console.log(user);

      return await this.prisma.uSER.update({
        where: { id },
        data: user,
      });
    } catch (error) {
      throw new BadRequestException(`Failed to update user: ${error}`);
    }
  }

  async delete(id: string): Promise<USER> {
    try {
      const user = await this.findById(id);
      if (!user) {
        throw new NotFoundException(`User not found`);
      }

      // Additional safety check: Prevent deletion of system super admins
      if (user.role === 'system_super_admin') {
        throw new BadRequestException(
          'Cannot delete system super admin users for security reasons',
        );
      }

      // Check if user is the only owner of any organization
      const ownedOrganizations = await this.prisma.organization.findMany({
        where: { owner_id: id },
      });

      if (ownedOrganizations.length > 0) {
        // Check if there are other users in the organization who could become owners
        for (const org of ownedOrganizations) {
          const otherUsers = await this.prisma.uSER.findMany({
            where: {
              organization_id: org.id,
              id: { not: id },
              role: { in: ['organization_admin', 'organization_super_admin'] },
            },
          });

          if (otherUsers.length === 0) {
            throw new BadRequestException(
              `Cannot delete user. User is the only admin/owner of organization: ${org.name}. Please assign another admin first.`,
            );
          }
        }
      }

      // Use a transaction to handle all deletions atomically
      return await this.prisma.$transaction(async (tx) => {
        // 1. Delete sessions (has RESTRICT constraint)
        await tx.session.deleteMany({
          where: { userId: id },
        });

        // 2. Delete email verifications (has RESTRICT constraint)
        await tx.emailVerification.deleteMany({
          where: { userId: id },
        });

        // 3. Delete email invitations (has RESTRICT constraint)
        await tx.emailInvitation.deleteMany({
          where: { userId: id },
        });

        // 4. Handle organization relationships (has RESTRICT constraints)
        // Update organizations where this user is admin_id
        await tx.organization.updateMany({
          where: { admin_id: id },
          data: { admin_id: null },
        });

        // Update organizations where this user is owner_id
        await tx.organization.updateMany({
          where: { owner_id: id },
          data: { owner_id: null },
        });

        // Update organizations where this user is admin_id
        await tx.organization.updateMany({
          where: { admin_id: id },
          data: { admin_id: null },
        });

        // 5. Update hire requests where this user is assigned (has SET NULL constraint)
        await tx.hireRequest.updateMany({
          where: { assign_user_id: id },
          data: { assign_user_id: null },
        });

        // 6. Update tickets where this user is the user (has SET NULL constraint)
        await tx.ticket.updateMany({
          where: { user_id: id },
          data: { user_id: null },
        });

        // 7. Finally, delete the user
        return await tx.uSER.delete({
          where: { id },
        });
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(`Failed to delete user: ${error}`);
    }
  }

  async updateStatus(id: string): Promise<USER> {
    try {
      const currentUser = await this.findById(id);
      if (!currentUser) throw new NotFoundException(`User not found`);
      if (currentUser.status !== 'prospect')
        new BadRequestException(`User status is not prospect`);

      return await this.prisma.uSER.update({
        where: { id },
        data: {
          status: 'client',
        },
      });
    } catch (error) {
      throw new BadRequestException(`Failed to update user status: ${error}`);
    }
  }

  async searchUsers(query: SearchUsersDto): Promise<any[]> {
    const { search, role, status, organization_id, limit = 10 } = query;

    const whereClause: Prisma.USERWhereInput = {};

    // Add search filter
    if (search) {
      whereClause.OR = [
        {
          first_name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          last_name: {
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
          job_title: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    // Add role filter
    if (role) {
      whereClause.role = role;
    }

    // Add status filter
    if (status) {
      whereClause.status = status;
    }

    // Add organization filter
    if (organization_id) {
      whereClause.organization_id = organization_id;
    }

    const users = await this.prisma.uSER.findMany({
      where: whereClause,
      take: limit,
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        job_title: true,
        role: true,
        status: true,
        organization_name: true,
        organization_id: true,
        avatar: true,
        phone: true,
        verified: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform users to handle empty avatars
    return users.map((user) => ({
      ...user,
      avatar:
        user.avatar ||
        this.generateDefaultAvatar(user.first_name, user.last_name),
      full_name: `${user.first_name} ${user.last_name}`.trim(),
    }));
  }

  private generateDefaultAvatar(firstName: string, lastName: string): string {
    // Generate initials for default avatar
    const initials =
      `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    // Return a data URL for a simple colored circle with initials
    // This is a simple SVG-based avatar
    const svg = `
      <svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="20" r="20" fill="#4F46E5"/>
        <text x="20" y="26" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">${initials}</text>
      </svg>
    `;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }

  async getOrganizationUsersPaginated(
    organizationId: string,
    query: any,
  ): Promise<any> {
    const {
      page = 1,
      limit = 10,
      search,
      role,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    // Build where clause
    const whereClause: any = {
      organization_id: organizationId,
    };

    // Add search filter
    if (search) {
      whereClause.OR = [
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { job_title: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Add role filter
    if (role) {
      whereClause.role = role;
    }

    // Add status filter
    if (status) {
      whereClause.status = status;
    }

    // Build orderBy clause
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    try {
      // Get total count
      const total = await this.prisma.uSER.count({
        where: whereClause,
      });

      // Get paginated users
      const users = await this.prisma.uSER.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          phone: true,
          avatar: true,
          job_title: true,
          role: true,
          status: true,
          verified: true,
          organization_id: true,
          organization_name: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Transform users to include full_name and default avatar
      const transformedUsers = users.map((user) => ({
        ...user,
        full_name: `${user.first_name} ${user.last_name}`.trim(),
        avatar:
          user.avatar ||
          this.generateDefaultAvatar(user.first_name, user.last_name),
      }));

      const totalPages = Math.ceil(total / limit);

      return {
        users: transformedUsers,
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };
    } catch (error) {
      throw new NotFoundException('Failed to fetch organization users');
    }
  }

  async inviteUserToOrganization(
    organizationId: string,
    inviteData: InviteUserToOrganizationDto,
    currentUser: USER,
  ): Promise<string> {
    try {
      // Check if user already exists
      const existingUser = await this.prisma.uSER.findUnique({
        where: { email: inviteData.email },
      });

      if (existingUser) {
        throw new BadRequestException('User with this email already exists');
      }

      // Get organization details
      const organization = await this.prisma.organization.findUnique({
        where: { id: organizationId },
      });

      if (!organization) {
        throw new NotFoundException('Organization not found');
      }

      // Create the user with invited status
      const newUser = await this.prisma.uSER.create({
        data: {
          email: inviteData.email,
          first_name: inviteData.first_name || '',
          last_name: inviteData.last_name || '',
          phone: inviteData.phone || '',
          job_title: inviteData.job_title || '',
          organization_id: organizationId,
          organization_name: organization.name,
          role: inviteData.role || 'organization_admin',
          workos_id: '',
          password: '', // Will be set when user completes signup
          authentication_method: 'OwnSign',
          status: 'invited',
          verified: false,
          avatar: '',
          createdByMethod: 'admin_invite',
          createdByUserId: currentUser.id,
        },
      });

      // Generate invitation token
      const code = jwt.sign({ id: newUser.id }, process.env.JWT_SECRET, {
        expiresIn: '24h',
      });

      // Send signup link via email
      const inviteLink = `${process.env.FRONTEND_URL}/invite-signup?code=${code}`;
      const emailBody = InviteSignup(inviteLink);
      const mailSent = await this.mailService.sendMail({
        from: 'MedVirtual <noreply@medvirtual.ai>',
        to: inviteData.email,
        subject: 'Welcome to MedVirtual - Complete Your Account Setup',
        html: emailBody,
        headers: {
          'X-Mailer': 'MedVirtual Platform',
          'X-Priority': '3',
          'List-Unsubscribe': '<mailto:unsubscribe@medvirtual.ai>',
          'X-Entity-Ref-ID': `invite-${newUser.id}`,
        },
      });

      if (!mailSent) {
        throw new BadRequestException('Failed to send invitation email');
      }

      // Store the verification code in the database with an expiration time
      const codeExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours - same time as JWT
      const storeCode = await this.prisma.emailInvitation.create({
        data: {
          userId: newUser.id,
          email_from: inviteData.email,
          code: code,
          expiresAt: codeExpiresAt,
        },
      });
      if (!storeCode) {
        throw new BadRequestException('Failed to store invite code');
      }

      return `Invitation sent successfully to ${inviteData.email}`;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to invite user to organization');
    }
  }
}
