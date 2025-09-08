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

  async create(userData: Prisma.USERCreateInput): Promise<USER> {
    const { password, ...rest } = userData;
    const hash = await bcrypt.hash(password, 10);

    const newUserData = {
      ...rest,
      password: hash,
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
    const users = await this.prisma.uSER.findMany({
      where: { organization_id: user.organization_id },
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
      throw new NotFoundException(`No users found in this organization.`);
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

      // Handle organization updates if organization fields are provided
      if (
        profileData.organization_name ||
        profileData.organization_description
      ) {
        if (currentUser.organization_id) {
          // Update existing organization
          await this.prisma.organization.update({
            where: { id: currentUser.organization_id },
            data: {
              ...(profileData.organization_name && {
                name: profileData.organization_name,
              }),
              ...(profileData.organization_description && {
                description: profileData.organization_description,
              }),
            },
          });
        }
      }

      const updatedUser = await this.prisma.uSER.update({
        where: { id },
        data: profileData,
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
      await this.findById(id);
      return await this.prisma.uSER.delete({
        where: { id },
      });
    } catch (error) {
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
    // currentUser: USER,
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
        subject: 'MedVirtual Invitation',
        html: emailBody,
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
