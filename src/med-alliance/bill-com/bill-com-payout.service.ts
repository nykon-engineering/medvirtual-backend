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

  // Transitions approved → processing. Calls Bill.com createBill then createPayment.
  async initiatePayment(id: string, adminUser: USER) {
    const request = await this.prisma.affiliatePayoutRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        approved_amount: true,
        requested_amount: true,
        affiliate_profile_id: true,
      },
    });
    if (!request) throw new NotFoundException('Payout request not found');

    if (request.status !== 'approved') {
      throw new BadRequestException(
        `Payout request must be "approved" to initiate a Bill.com payment (current: "${request.status}").`,
      );
    }

    const profile = await this.prisma.affiliateProfile.findUnique({
      where: { id: request.affiliate_profile_id },
      select: { payout_details: true },
    });

    const payoutDetails = profile?.payout_details as Record<
      string,
      unknown
    > | null;
    const vendorId = payoutDetails?.account_number as string | undefined;

    if (!vendorId) {
      throw new BadRequestException(
        'Affiliate payout_details is missing "account_number". Cannot initiate Bill.com payment.',
      );
    }

    const amount = parseFloat(
      String(request.approved_amount ?? request.requested_amount ?? 0),
    );
    const today = this.toDateString(new Date());

    const { billId } = await this.billComService.createBill({
      vendorId,
      dueDate: today,
      amount,
      description: 'Alliance commission payout',
      invoiceNumber: id,
      invoiceDate: today,
    });

    const { paymentId } = await this.billComService.createPayment({
      vendorId,
      billId,
      amount,
      processDate: today,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.affiliatePayoutRequest.update({
        where: { id },
        data: {
          status: 'processing',
          bill_com_payment_id: paymentId,
          bill_com_status: 'SCHEDULED',
          bill_com_error: null,
          payment_method: 'bill_com',
        },
      });
    });

    await this.writeAuditLog({
      actorUserId: adminUser.id,
      entityId: id,
      event: 'bill_com_payment_initiated',
      oldStatus: 'approved',
      newStatus: 'processing',
      source: 'admin_action',
    });

    return this.findOneForAdmin(id);
  }

  // Resets failed → approved so the admin can retry.
  async retryPayment(id: string, adminUser: USER) {
    const request = await this.prisma.affiliatePayoutRequest.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!request) throw new NotFoundException('Payout request not found');

    if (request.status !== 'failed') {
      throw new BadRequestException(
        `Payout request must be "failed" to retry (current: "${request.status}").`,
      );
    }

    await this.prisma.affiliatePayoutRequest.update({
      where: { id },
      data: {
        status: 'approved',
        bill_com_payment_id: null,
        bill_com_status: null,
        bill_com_error: null,
      },
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

    return this.findOneForAdmin(id);
  }

  // Called by webhook handler after Bill.com confirms the payment. Idempotent.
  async finalizeAsPaid(billComPaymentId: string): Promise<void> {
    const request = await this.prisma.affiliatePayoutRequest.findFirst({
      where: { bill_com_payment_id: billComPaymentId },
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
        `finalizeAsPaid: no payout request found for bill_com_payment_id=${billComPaymentId}`,
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
          transaction_reference: billComPaymentId,
          payment_reference: billComPaymentId,
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
  async markAsFailed(
    billComPaymentId: string,
    errorMsg: string,
  ): Promise<void> {
    const request = await this.prisma.affiliatePayoutRequest.findFirst({
      where: { bill_com_payment_id: billComPaymentId },
      select: {
        id: true,
        status: true,
        approved_amount: true,
        requested_amount: true,
        affiliate: {
          select: { first_name: true, last_name: true, email: true },
        },
      },
    });

    if (!request) {
      this.logger.warn(
        `markAsFailed: no payout request found for bill_com_payment_id=${billComPaymentId}`,
      );
      return;
    }

    if (request.status !== 'processing') {
      this.logger.debug(
        `markAsFailed: payout ${request.id} is in status "${request.status}", skipping`,
      );
      return;
    }

    await this.prisma.affiliatePayoutRequest.update({
      where: { id: request.id },
      data: {
        status: 'failed',
        bill_com_status: 'FAILED',
        bill_com_error: errorMsg,
      },
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

    await this.notifyAdminsOfFailure(
      request.id,
      request.affiliate,
      parseFloat(
        String(request.approved_amount ?? request.requested_amount ?? 0),
      ),
      billComPaymentId,
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
    billComPaymentId: string,
    errorMsg: string,
  ): Promise<void> {
    const partnerName = affiliate
      ? `${affiliate.first_name ?? ''} ${affiliate.last_name ?? ''}`.trim() ||
        affiliate.email
      : 'Unknown partner';

    void this.allianceNotifications.notifyAdminPaymentFailed({
      partnerName,
      amount,
      billComPaymentId,
      errorMsg,
      payoutRequestId,
    });
  }
}
