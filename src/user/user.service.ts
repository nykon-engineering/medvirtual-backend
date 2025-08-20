
import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, USER } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userData: Prisma.USERCreateInput): Promise<USER> {
    const {password, ...rest} = userData;
    const hash = await bcrypt.hash(password, 10);
    
    const newUserData = {
      ...rest,
      password: hash,
    }

    const newUser = await this.prisma.uSER.create({
      data: newUserData,
    })
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

  async findByOrganizationId(organizationId: string): Promise<any>{
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
      }
    });
    if (!users || users.length === 0) {
      throw new NotFoundException(`No users found in this organization.`);
    }
    
    return users;
  }

  async update(id: string, userData: Prisma.USERUpdateInput): Promise<USER> {
    try {
      let user;
      const currentUser = await this.findById(id);
      if (!currentUser){
        throw new NotFoundException(`User not found`);
      }

      //verify user to update status
      if (userData.job_title && userData.organization_name && currentUser.status === 'incomplete') {
        user = {...userData, status: 'active'};
      }else{
        user = {...userData};
      }
      console.log(user);
      
      return await this.prisma.uSER.update({
        where: { id },
        data: user,
      });
    } catch (error){
      throw new BadRequestException(`Failed to update user: ${error.message}`);
    }
    
  }

  async delete(id: string): Promise<USER> {
    try {
      await this.findById(id);
      return await this.prisma.uSER.delete({
        where: { id },
      });
    } catch (error) {
      throw new BadRequestException(`Failed to delete user: ${error.message}`);
    }
  }

  async updateStatus(id: string): Promise<USER> {
    try {
      const currentUser = await this.findById(id);
      if (!currentUser) throw new NotFoundException(`User not found`);
      if (currentUser.status !== 'prospect')  new BadRequestException(`User status is not prospect`);
      
      
      return await this.prisma.uSER.update({
        where: { id },
        data:{
          status: 'client'
        }
      });
    } catch (error){
      throw new BadRequestException(`Failed to update user status: ${error.message}`);
    }
    
  }

}
