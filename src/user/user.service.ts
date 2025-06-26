
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userData: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data: userData });
  }
}
