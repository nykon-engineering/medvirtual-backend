import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SessionActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async recordPing(
    userId: string,
    sessionId: string,
    scope: 'talent_pool' | 'platform',
  ): Promise<void> {
    await this.prisma.sessionActivity.create({
      data: { userId, sessionId, scope },
    });
  }
}
