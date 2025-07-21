import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Organization } from '@prisma/client';
import { CreateOrganizationDto } from './dto/createOrganization.dto';
import { UpdateOrganizationDto } from './dto/updateOrganization.dto';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateOrganizationDto): Promise<Organization> {
    try {
      return await this.prisma.organization.create({
        data: {
          name: data.name,
          contact_info: data.cellphone,
          email: data.email,
        },
      });
    } catch {
      throw new BadRequestException('Failed to create organization');
    }
  }

  async update(id: string, data: UpdateOrganizationDto): Promise<Organization> {
    try {
      return await this.prisma.organization.update({
        where: { id },
        data: {
          name: data.name,
          contact_info: data.cellphone,
          email: data.email,
        },
      });
    } catch {
      throw new BadRequestException('Failed to update organization');
    }
  }

  async delete(id: string): Promise<Organization> {
    try {
      return await this.prisma.organization.delete({
        where: { id },
      });
    } catch {
      throw new NotFoundException('Organization not found');
    }
  }
}
