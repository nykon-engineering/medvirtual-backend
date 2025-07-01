
import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import * as jwt from 'jsonwebtoken';

import { PrismaService } from '../prisma/prisma.service';
import { WorkosService } from '../workos/workos.service';

@Injectable()
export class UserService {
  @Inject()
  private readonly prisma: PrismaService;

  async create(userData: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data: userData });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: number): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`User not found`);
    }
    return user;
  }

  async findByOrganizationId(organizationId: string): Promise<User[] | null>{
    const users = await this.prisma.user.findMany({
      where: { organizationId },
    });
    if (!users || users.length === 0) {
      throw new NotFoundException(`No users found in this organization.`);
    }
    return users;
  }

  async update(id: number, userData: Prisma.UserUpdateInput): Promise<User> {
    try {
      await this.findById(id);
      return await this.prisma.user.update({
        where: { id },
        data: userData,
      });
    } catch (error){
      throw new BadRequestException(`Failed to update user: ${error.message}`);
    }
    
  }

  async delete(id: number): Promise<User> {
    try {
      await this.findById(id);
      return await this.prisma.user.delete({
        where: { id },
      });
    } catch (error) {
      throw new BadRequestException(`Failed to delete user: ${error.message}`);
    }
    
  }

}
