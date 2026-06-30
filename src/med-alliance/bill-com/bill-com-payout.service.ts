import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BillComService } from './bill-com.service';
import { USER } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
  ADMIN_SELECT,
  shapeAdminRequest,
} from '../payout-requests/payout-request.selects';
import { AllianceNotificationsService } from '../notifications/notifications.service';

interface BillComPaymentPayload {
  vendorId: string;
  affiliateName: string;
  affiliateEmail: string;
  amount: number;
  today: string;
}

@Injectable()
export class BillComPayoutService {
  private readonly logger = new Logger(BillComPayoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billComService: BillComService,
    private readonly allianceNotifications: AllianceNotificationsService,
  ) {}

  private toDateString(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private async writeAuditLog(params: {
    actorUserId: string | null;
    entityId: string;
    event: string;
    oldStatus: string | null;
    newStatus: string | null;
    reason?: string;
    source: 'user' | 'sync' | 'admin_action' | 'cron';
  }) {
    await this.prisma.medAllianceAuditLog.create({
      data: {
        actor_user_id: params.actorUserId,
        entity_type: 'payout_request',
        entity_id: params.entityId,
        event: params.event,
        old_status: params.oldStatus,
        new_status: params.newStatus,
        reason: params.reason ?? null,
        source: params.source,
      },
    });
  }

  async findOneForAdmin(id: string) {
    const request = await this.prisma.affiliatePayoutRequest.findUnique({
      where: { id },
      select: ADMIN_SELECT,
    });
    if (!request) throw new NotFoundException('Payout request not found');
    return shapeAdminRequest(request);
  }

  async validateAndPreparePayment(id: string): Promise<BillComPaymentPayload> {
    const request = await this.prisma.affiliatePayoutRequest.findUnique({
      where: { id },
      select: {
        id: true,
        approved_amount: true,
        requested_amount: true,
        affiliate_profile_id: true,
      },
    });
    if (!request) throw new NotFoundException('Payout request not found');

    const profile = await this.prisma.affiliateProfile.findUnique({
      where: { id: request.affiliate_profile_id },
      select: {
        status: true,
        contact: {
          select: { hubspot_billcom_vendor_id: true },
        },
        user: {
          select: {
            first_name: true,
            last_name: true,
            email: true,
            contact: {
              select: { hubspot_billcom_vendor_id: true },
            },
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException(
        'Affiliate profile not found for this payout request. Cannot initiate Bill.com payment.',
      );
    }
    if (profile.status !== 'active') {
      throw new BadRequestException(
        'Affiliate profile is not active. Cannot initiate Bill.com payment.',
      );
    }

    const vendorId = (profile?.contact?.hubspot_billcom_vendor_id ??
      profile?.user?.contact?.hubspot_billcom_vendor_id) as string | undefined;
    if (!vendorId) {
      throw new BadRequestException(
        'Bill.com vendor ID is missing for this affiliate. Cannot initiate Bill.com payment.',
      );
    }

    const affiliateName =
      `${profile?.user?.first_name ?? ''} ${profile?.user?.last_name ?? ''}`.trim() ||
      profile?.user?.email ||
      'Unknown affiliate';
    const affiliateEmail = profile?.user?.email ?? 'Unknown email';
    const amount = parseFloat(
      String(request.approved_amount ?? request.requested_amount ?? 0),
    );
    const today = this.toDateString(new Date(Date.now() + 24 * 60 * 60 * 1000));

    return {
      vendorId,
      affiliateName,
      affiliateEmail,
      amount,
      today,
    };
  }

  async createBillAndPaymentForMarkPaid(
    payload: BillComPaymentPayload,
    adminUser: USER,
    id: string,
  ) {
    const { vendorId, affiliateName, affiliateEmail, amount, today } = payload;

    return this.billComService.createBillAndPayment({
      vendorId,
      amount,
      processDate: today,
      description: `Created by ${adminUser.first_name} ${adminUser.last_name} for affiliate ${affiliateName}`,
    });
  }

  // Standalone endpoint: validate + call Bill.com + persist atomically for a single request.
  async initiatePayment(id: string, adminUser: USER) {
    const request = await this.prisma.affiliatePayoutRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        approved_amount: true,
        requested_amount: true,
        commissions: { select: { commission_id: true } },
      },
    });
    if (!request) throw new NotFoundException('Payout request not found');

    const payableStatuses = ['under_review', 'approved'];
    if (!payableStatuses.includes(request.status)) {
      throw new BadRequestException(
        `Payout request must be "under_review" or "approved" to initiate a Bill.com payment (current: "${request.status}").`,
      );
    }

    const billPayload = await this.validateAndPreparePayment(id);
    const { vendorId, affiliateName, affiliateEmail, amount, today } =
      billPayload;

    const result = await this.billComService.createBillAndPayment({
      vendorId,
      amount,
      processDate: today,
      description: `Bill created by ${adminUser.first_name} ${adminUser.last_name} (${adminUser.email}) for affiliate ${affiliateName} (${affiliateEmail}) through the payout request id ${id}`,
    });

    const commissionIds = request.commissions.map((c) => c.commission_id);

    await this.prisma.$transaction(async (tx) => {
      await tx.affiliatePayoutRequest.update({
        where: { id },
        data: {
          status: 'processing',
          bill_com_billId: result.billId,
          bill_com_payment_id: result.paymentId,
          bill_com_status: result.status,
          bill_com_error: null,
          payment_method: 'bill_com',
        },
      });

      if (commissionIds.length > 0) {
        await tx.affiliateCommission.updateMany({
          where: { id: { in: commissionIds } },
          data: { status: 'paid' },
        });
      }
    });

    await this.writeAuditLog({
      actorUserId: adminUser.id,
      entityId: id,
      event: 'bill_com_payment_initiated',
      oldStatus: request.status,
      newStatus: 'processing',
      source: 'admin_action',
    });

    return this.findOneForAdmin(id);
  }

  // Resets failed → approved so the admin can retry.
  async retryPayment(id: string, adminUser: USER) {
    const request = await this.prisma.affiliatePayoutRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        commissions: { select: { commission_id: true } },
      },
    });
    if (!request) throw new NotFoundException('Payout request not found');

    if (request.status !== 'failed') {
      throw new BadRequestException(
        `Payout request must be "failed" to retry (current: "${request.status}").`,
      );
    }

    const commissionIds = request.commissions.map((c) => c.commission_id);

    await this.prisma.$transaction(async (tx) => {
      await tx.affiliatePayoutRequest.update({
        where: { id },
        data: {
          status: 'approved',
          bill_com_payment_id: null,
          bill_com_status: null,
          bill_com_error: null,
        },
      });

      if (commissionIds.length > 0) {
        await tx.affiliateCommission.updateMany({
          where: { id: { in: commissionIds } },
          data: { status: 'requested' },
        });
      }
    });

    await this.writeAuditLog({
      actorUserId: adminUser.id,
      entityId: id,
      event: 'status_changed',
      oldStatus: 'failed',
      newStatus: 'approved',
      reason: 'Admin retried Bill.com payment',
      source: 'admin_action',
    });

    for (const commissionId of commissionIds) {
      await this.prisma.medAllianceAuditLog.create({
        data: {
          actor_user_id: adminUser.id,
          entity_type: 'commission',
          entity_id: commissionId,
          event: 'status_changed',
          old_status: 'eligible',
          new_status: 'requested',
          reason: 'Payout request retry — commissions re-requested',
          source: 'admin_action',
          metadata: { payout_request_id: id } as any,
        },
      });
    }

    return this.findOneForAdmin(id);
  }

  // Called by webhook handler after Bill.com confirms the payment. Idempotent.
  async finalizeAsPaid(
    billIds: string[],
    transaction_reference: string,
  ): Promise<void> {
    const request = await this.prisma.affiliatePayoutRequest.findFirst({
      where: { bill_com_billId: { in: billIds } },
      select: {
        id: true,
        status: true,
        approved_amount: true,
        requested_amount: true,
        affiliate_id: true,
        commissions: { select: { commission_id: true } },
        affiliate: { select: { id: true, first_name: true, email: true } },
      },
    });

    if (!request) {
      this.logger.warn(
        `finalizeAsPaid: no payout request found for bill_com_billId in [${billIds.join(', ')}]`,
      );
      return;
    }

    if (request.status !== 'processing') {
      this.logger.debug(
        `finalizeAsPaid: payout ${request.id} already in status "${request.status}", skipping`,
      );
      return;
    }

    const paidAmount = parseFloat(
      String(request.approved_amount ?? request.requested_amount ?? 0),
    );
    const commissionIds = request.commissions.map((c) => c.commission_id);

    await this.prisma.$transaction(async (tx) => {
      await tx.affiliatePayoutRequest.update({
        where: { id: request.id },
        data: {
          status: 'paid',
          paid_at: new Date(),
          paid_amount: new Decimal(paidAmount),
          bill_com_status: 'PAID',
          bill_com_paymentStatus: 'PAID',
          //transaction_reference: transaction_reference, It was populated when we send the request to Bill.com
          payment_reference: transaction_reference,
        },
      });

      if (commissionIds.length > 0) {
        await tx.affiliateCommission.updateMany({
          where: { id: { in: commissionIds } },
          data: { status: 'paid' },
        });
      }
    });

    await this.writeAuditLog({
      actorUserId: null,
      entityId: request.id,
      event: 'status_changed',
      oldStatus: 'processing',
      newStatus: 'paid',
      source: 'sync',
    });

    if (request.affiliate?.email) {
      void this.allianceNotifications.notifyPayoutPaid(
        {
          email: request.affiliate.email,
          first_name: request.affiliate.first_name ?? '',
        },
        { totalAmount: paidAmount, paidAt: new Date() },
      );
    }
  }

  // Called by webhook handler when Bill.com reports a payment failure. Idempotent.
  async markAsFailed(billIds: string[], errorMsg: string): Promise<void> {
    const request = await this.prisma.affiliatePayoutRequest.findFirst({
      where: { bill_com_billId: { in: billIds } },
      select: {
        id: true,
        status: true,
        approved_amount: true,
        requested_amount: true,
        commissions: { select: { commission_id: true } },
        affiliate: {
          select: { first_name: true, last_name: true, email: true },
        },
      },
    });

    if (!request) {
      this.logger.warn(
        `markAsFailed: no payout request found for bill_com_billId in [${billIds.join(', ')}]`,
      );
      return;
    }

    if (request.status !== 'processing') {
      this.logger.debug(
        `markAsFailed: payout ${request.id} is in status "${request.status}", skipping`,
      );
      return;
    }

    const commissionIds = request.commissions.map((c) => c.commission_id);

    await this.prisma.$transaction(async (tx) => {
      await tx.affiliatePayoutRequest.update({
        where: { id: request.id },
        data: {
          status: 'failed',
          bill_com_status: 'FAILED',
          bill_com_error: errorMsg,
        },
      });

      if (commissionIds.length > 0) {
        await tx.affiliateCommission.updateMany({
          where: { id: { in: commissionIds } },
          data: { status: 'eligible' },
        });
      }
    });

    await this.writeAuditLog({
      actorUserId: null,
      entityId: request.id,
      event: 'bill_com_payment_failed',
      oldStatus: 'processing',
      newStatus: 'failed',
      reason: errorMsg,
      source: 'sync',
    });

    for (const commissionId of commissionIds) {
      await this.prisma.medAllianceAuditLog.create({
        data: {
          actor_user_id: null,
          entity_type: 'commission',
          entity_id: commissionId,
          event: 'status_changed',
          old_status: 'paid',
          new_status: 'eligible',
          reason: 'Bill.com payment failed — reverted to eligible',
          source: 'sync',
          metadata: { payout_request_id: request.id } as any,
        },
      });
    }

    await this.notifyAdminsOfFailure(
      request.id,
      request.affiliate,
      parseFloat(
        String(request.approved_amount ?? request.requested_amount ?? 0),
      ),
      billIds.join(', '),
      errorMsg,
    );
  }

  private async notifyAdminsOfFailure(
    payoutRequestId: string,
    affiliate: {
      first_name: string | null;
      last_name: string | null;
      email: string;
    } | null,
    amount: number,
    billIds: string,
    errorMsg: string,
  ): Promise<void> {
    const partnerName = affiliate
      ? `${affiliate.first_name ?? ''} ${affiliate.last_name ?? ''}`.trim() ||
        affiliate.email
      : 'Unknown partner';

    void this.allianceNotifications.notifyAdminPaymentFailed({
      partnerName,
      amount,
      billIds,
      errorMsg,
      payoutRequestId,
    });
  }
}
