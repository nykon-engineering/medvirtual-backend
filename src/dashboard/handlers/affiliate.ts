import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HandlerAffiliate {
  constructor(private readonly prisma: PrismaService) {}

  async execute(user: { id: string }): Promise<object> {
    const [
      totalEarnedAgg,
      pendingAmountAgg,
      totalCompaniesReferred,
      pendingPayoutRequests,
      recentCommissions,
      recentCompanies,
    ] = await this.prisma.$transaction([
      // Sum of commission_amount where status = 'paid'
      this.prisma.affiliateCommission.aggregate({
        where: {
          affiliate_id: user.id,
          status: 'paid',
        },
        _sum: { commission_amount: true },
      }),

      // Sum of commission_amount where status IN ['eligible', 'pending_admin_confirmation']
      this.prisma.affiliateCommission.aggregate({
        where: {
          affiliate_id: user.id,
          status: { in: ['eligible', 'pending_admin_confirmation'] },
        },
        _sum: { commission_amount: true },
      }),

      // Count of organizations referred (status != 'deleted')
      this.prisma.organization.count({
        where: {
          referred_by_affiliate_id: user.id,
          status: { not: 'deleted' },
        },
      }),

      // Count of pending payout requests
      this.prisma.affiliatePayoutRequest.count({
        where: {
          affiliate_id: user.id,
          status: { in: ['requested', 'approved'] },
        },
      }),

      // Last 5 commissions
      this.prisma.affiliateCommission.findMany({
        where: { affiliate_id: user.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          status: true,
          commission_amount: true,
          commission_percent_snapshot: true,
          createdAt: true,
          organization: {
            select: { id: true, name: true },
          },
        },
      }),

      // Last 4 referred companies (status != 'deleted')
      this.prisma.organization.findMany({
        where: {
          referred_by_affiliate_id: user.id,
          status: { not: 'deleted' },
        },
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          med_alliance_referral_status: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      totalEarned: Number(totalEarnedAgg._sum.commission_amount ?? 0),
      pendingAmount: Number(pendingAmountAgg._sum.commission_amount ?? 0),
      totalCompaniesReferred,
      pendingPayoutRequests,
      recentCommissions,
      recentCompanies,
    };
  }
}
