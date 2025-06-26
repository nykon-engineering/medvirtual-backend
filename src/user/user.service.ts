
import { Inject, Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import * as jwt from 'jsonwebtoken';

import { PrismaService } from '../prisma/prisma.service';
import { WorkosService } from '../workos/workos.service';

@Injectable()
export class UserService {
  @Inject()
  private readonly prisma: PrismaService;
  private readonly workosService: WorkosService

  async create(userData: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data: userData });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }


  async handleUser(code: string): Promise<string> {
    const profile = await this.workosService.getProfile(code);

    let user = await this.findByEmail(profile.email);
    if (!user) {
      user = await this.create({
        email: profile.email,
        name: `${profile.firstName} ${profile.lastName}`,
        role: profile.role?.slug || 'user',
        workosId: profile.id,
      });
    }

    const token = jwt.sign({id: user.id}, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });
    
    return token;

  }
}
