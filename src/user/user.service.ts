import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, USER } from '@prisma/client';
// import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/updateProfile.dto';
import { GetProfileDto } from './dto/getProfile.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

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
            email: user.organization.email,
            phone: user.organization.phone || undefined,
            website_url: user.organization.website_url || undefined,
            location: user.organization.location || undefined,
            status: user.organization.status,
            organization_role: user.organization.organization_role,
            specialties: user.organization.specialties || undefined,
            services: user.organization.services || undefined,
            description: user.organization.description || undefined,
            industry: user.organization.industry || undefined,
            number_of_employees: user.organization.number_of_employees || undefined,
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
              email: updatedUser.organization.email,
              phone: updatedUser.organization.phone || undefined,
              website_url: updatedUser.organization.website_url || undefined,
              location: updatedUser.organization.location || undefined,
              status: updatedUser.organization.status,
              organization_role: updatedUser.organization.organization_role,
              specialties: updatedUser.organization.specialties || undefined,
              services: updatedUser.organization.services || undefined,
              description: updatedUser.organization.description || undefined,
              industry: updatedUser.organization.industry || undefined,
              number_of_employees: updatedUser.organization.number_of_employees || undefined,
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
}
