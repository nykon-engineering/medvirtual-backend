import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BillComLoginResult } from './bill-com.service';

export type BillComNextStep = 'proceed' | 'mfa_challenge' | 'phone_setup';

@Injectable()
export class BillComAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async determineNextStep(
    userId: string,
    loginResult: BillComLoginResult,
  ): Promise<BillComNextStep> {
    if (loginResult.trusted) return 'proceed';

    const user = await this.prisma.uSER.findUniqueOrThrow({
      where: { id: userId },
      select: { billcom_device: true },
    });

    return user.billcom_device ? 'mfa_challenge' : 'phone_setup';
  }
}
