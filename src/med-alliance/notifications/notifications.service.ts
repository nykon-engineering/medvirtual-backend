import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import {
  EmailTheme,
  getEmailThemeByBusinessUnit,
} from '../../common/utils/email-templates/theme';
import {
  commissionEligibleTemplate,
  CommissionEligiblePayload,
} from './templates/commission-eligible';
import { payoutPaidTemplate, PayoutPaidPayload } from './templates/payout-paid';
import {
  payoutCancelledTemplate,
  PayoutCancelledPayload,
} from './templates/payout-cancelled';
import {
  referralStageChangedTemplate,
  ReferralStageChangedPayload,
} from './templates/referral-stage-changed';
import {
  adminPayoutRequestedTemplate,
  AdminPayoutRequestedPayload,
} from './templates/admin-payout-requested';
import {
  adminCommissionPendingTemplate,
  AdminCommissionPendingPayload,
} from './templates/admin-commission-pending';
import {
  adminReferralNewTemplate,
  AdminReferralNewPayload,
} from './templates/admin-referral-new';
import {
  adminPartnerRegisteredTemplate,
  AdminPartnerRegisteredPayload,
} from './templates/admin-partner-registered';
import {
  adminPaymentFailedTemplate,
  AdminPaymentFailedPayload,
} from './templates/admin-payment-failed';
import {
  adminCommissionRevertedTemplate,
  AdminCommissionRevertedPayload,
} from './templates/admin-commission-reverted';
import {
  adminCommissionPendingSummaryTemplate,
  AdminCommissionPendingSummaryPayload,
} from './templates/admin-commission-pending-summary';
import { payoutProcessingTemplate } from './templates/payout-processing';
import {
  adminMarkPaidErrorTemplate,
  AdminMarkPaidErrorPayload,
} from './templates/admin-markpaid-error';

@Injectable()
export class AllianceNotificationsService {
  private readonly logger = new Logger(AllianceNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  private defaultTheme(): EmailTheme {
    return getEmailThemeByBusinessUnit('MedVirtual');
  }

  private buildFrom(theme?: EmailTheme): string {
    const name = theme?.companyName || 'MedVirtual';
    const raw = `${name} <noreply@medvirtual.ai>`;
    const isProduction = process.env.ENVIRONMENT === 'PROD';
    return isProduction ? raw : `[DEV] ${raw}`;
  }

  private async getAdminEmails(): Promise<string[]> {
    const admins = await this.prisma.uSER.findMany({
      where: {
        role: { in: ['system_admin', 'system_super_admin'] },
        status: 'active',
      },
      select: { email: true },
    });
    return admins.map((a) => a.email);
  }

  async notifyCommissionEligible(
    affiliate: { email: string; first_name: string },
    payload: Omit<CommissionEligiblePayload, 'firstName'>,
    theme?: EmailTheme,
  ): Promise<void> {
    const resolvedTheme = theme ?? this.defaultTheme();
    try {
      await this.mail.sendMail({
        from: this.buildFrom(resolvedTheme),
        to: affiliate.email,
        subject: `Your commission is ready — $${payload.commissionAmount.toFixed(2)} from ${payload.organizationName}`,
        html: commissionEligibleTemplate(
          { firstName: affiliate.first_name, ...payload },
          resolvedTheme,
        ),
      });
    } catch (err) {
      this.logger.error(
        `Failed to send commission eligible email to ${affiliate.email}`,
        err,
      );
    }
  }

  async notifyPayoutCancelled(
    affiliate: { email: string; first_name: string },
    payload: Omit<PayoutCancelledPayload, 'firstName'>,
    theme?: EmailTheme,
  ): Promise<void> {
    const resolvedTheme = theme ?? this.defaultTheme();
    try {
      await this.mail.sendMail({
        from: this.buildFrom(resolvedTheme),
        to: affiliate.email,
        subject: `Your payout request of $${payload.totalAmount.toFixed(2)} has been cancelled`,
        html: payoutCancelledTemplate(
          { firstName: affiliate.first_name, ...payload },
          resolvedTheme,
        ),
      });
    } catch (err) {
      this.logger.error(
        `Failed to send payout cancelled email to ${affiliate.email}`,
        err,
      );
    }
  }

  async notifyPayoutProcessing(
    affiliate: { email: string; first_name: string },
    payload: Omit<
      { firstName: string; totalAmount: number; processedAt: Date },
      'firstName'
    >,
    theme?: EmailTheme,
  ): Promise<void> {
    const resolvedTheme = theme ?? this.defaultTheme();
    try {
      await this.mail.sendMail({
        from: this.buildFrom(resolvedTheme),
        to: affiliate.email,
        subject: `Your payout of $${payload.totalAmount.toFixed(2)} is being processed`,
        html: payoutProcessingTemplate(
          { firstName: affiliate.first_name, ...payload },
          resolvedTheme,
        ),
      });
    } catch (err) {
      this.logger.error(
        `Failed to send payout processing email to ${affiliate.email}`,
        err,
      );
    }
  }

  async notifyPayoutPaid(
    affiliate: { email: string; first_name: string },
    payload: Omit<PayoutPaidPayload, 'firstName'>,
    theme?: EmailTheme,
  ): Promise<void> {
    const resolvedTheme = theme ?? this.defaultTheme();
    try {
      await this.mail.sendMail({
        from: this.buildFrom(resolvedTheme),
        to: affiliate.email,
        subject: `Your payout of $${payload.totalAmount.toFixed(2)} has been processed`,
        html: payoutPaidTemplate(
          { firstName: affiliate.first_name, ...payload },
          resolvedTheme,
        ),
      });
    } catch (err) {
      this.logger.error(
        `Failed to send payout paid email to ${affiliate.email}`,
        err,
      );
    }
  }

  async notifyReferralStageChanged(
    affiliate: { email: string; first_name: string },
    payload: Omit<ReferralStageChangedPayload, 'firstName'>,
    theme?: EmailTheme,
  ): Promise<void> {
    const resolvedTheme = theme ?? this.defaultTheme();
    try {
      await this.mail.sendMail({
        from: this.buildFrom(resolvedTheme),
        to: affiliate.email,
        subject: `${payload.organizationName} has moved to ${payload.newStage.replace(/_/g, ' ')}`,
        html: referralStageChangedTemplate(
          { firstName: affiliate.first_name, ...payload },
          resolvedTheme,
        ),
      });
    } catch (err) {
      this.logger.error(
        `Failed to send referral stage changed email to ${affiliate.email}`,
        err,
      );
    }
  }

  async notifyAdminPayoutRequested(
    payload: AdminPayoutRequestedPayload,
    theme?: EmailTheme,
  ): Promise<void> {
    const resolvedTheme = theme ?? this.defaultTheme();
    try {
      const adminEmails = await this.getAdminEmails();
      const subject = `Payout request from ${payload.affiliateName} — $${payload.totalAmount.toFixed(2)}`;
      const html = adminPayoutRequestedTemplate(payload, resolvedTheme);
      for (const email of adminEmails) {
        try {
          await this.mail.sendMail({
            from: this.buildFrom(resolvedTheme),
            to: email,
            subject,
            html,
          });
        } catch (err) {
          this.logger.error(
            `Failed to send admin payout requested email to ${email}`,
            err,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        'Failed to send admin payout requested notifications',
        err,
      );
    }
  }

  async notifyAdminCommissionPending(
    payload: AdminCommissionPendingPayload,
    theme?: EmailTheme,
  ): Promise<void> {
    const resolvedTheme = theme ?? this.defaultTheme();
    try {
      const adminEmails = await this.getAdminEmails();
      const subject = `Commission ready for review — ${payload.organizationName}`;
      const html = adminCommissionPendingTemplate(payload, resolvedTheme);
      for (const email of adminEmails) {
        try {
          await this.mail.sendMail({
            from: this.buildFrom(resolvedTheme),
            to: email,
            subject,
            html,
          });
        } catch (err) {
          this.logger.error(
            `Failed to send admin commission pending email to ${email}`,
            err,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        'Failed to send admin commission pending notifications',
        err,
      );
    }
  }

  async notifyAdminCommissionReverted(
    payload: AdminCommissionRevertedPayload,
    theme?: EmailTheme,
  ): Promise<void> {
    const resolvedTheme = theme ?? this.defaultTheme();
    try {
      const adminEmails = await this.getAdminEmails();
      const subject = `Commission reverted to Pending — ${payload.organizationName}`;
      const html = adminCommissionRevertedTemplate(payload, resolvedTheme);
      for (const email of adminEmails) {
        try {
          await this.mail.sendMail({
            from: this.buildFrom(resolvedTheme),
            to: email,
            subject,
            html,
          });
        } catch (err) {
          this.logger.error(
            `Failed to send admin commission reverted email to ${email}`,
            err,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        'Failed to send admin commission reverted notifications',
        err,
      );
    }
  }

  async notifyAdminReferralNew(
    payload: AdminReferralNewPayload,
    theme?: EmailTheme,
  ): Promise<void> {
    const resolvedTheme = theme ?? this.defaultTheme();
    try {
      const adminEmails = await this.getAdminEmails();
      const subject = payload.adminName
        ? `New referral: ${payload.organizationName} — initiated by ${payload.adminName}`
        : `New referral: ${payload.organizationName} referred by ${payload.affiliateName}`;
      const html = adminReferralNewTemplate(payload, resolvedTheme);
      for (const email of adminEmails) {
        try {
          await this.mail.sendMail({
            from: this.buildFrom(resolvedTheme),
            to: email,
            subject,
            html,
          });
        } catch (err) {
          this.logger.error(
            `Failed to send admin new referral email to ${email}`,
            err,
          );
        }
      }
    } catch (err) {
      this.logger.error('Failed to send admin new referral notifications', err);
    }
  }

  async notifyAdminPartnerRegistered(
    payload: AdminPartnerRegisteredPayload,
    theme?: EmailTheme,
  ): Promise<void> {
    const resolvedTheme = theme ?? this.defaultTheme();
    try {
      const adminEmails = await this.getAdminEmails();
      const subject = `New Alliance partner registered: ${payload.partnerName}`;
      const html = adminPartnerRegisteredTemplate(payload, resolvedTheme);
      for (const email of adminEmails) {
        try {
          await this.mail.sendMail({
            from: this.buildFrom(resolvedTheme),
            to: email,
            subject,
            html,
          });
        } catch (err) {
          this.logger.error(
            `Failed to send admin partner registered email to ${email}`,
            err,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        'Failed to send admin partner registered notifications',
        err,
      );
    }
  }

  async notifyAdminDailyCommissionSummary(
    payload: AdminCommissionPendingSummaryPayload,
    theme?: EmailTheme,
  ): Promise<void> {
    const resolvedTheme = theme ?? this.defaultTheme();
    try {
      const adminEmails = await this.getAdminEmails();
      const subject = `Daily commission review — ${payload.commissions.length} pending ($${payload.totalAmount.toFixed(2)})`;
      const html = adminCommissionPendingSummaryTemplate(
        payload,
        resolvedTheme,
      );
      for (const email of adminEmails) {
        try {
          await this.mail.sendMail({
            from: this.buildFrom(resolvedTheme),
            to: email,
            subject,
            html,
          });
        } catch (err) {
          this.logger.error(
            `Failed to send daily commission summary email to ${email}`,
            err,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        'Failed to send daily commission summary notifications',
        err,
      );
    }
  }

  async notifyAdminMarkPaidError(
    payload: AdminMarkPaidErrorPayload,
    theme?: EmailTheme,
  ): Promise<void> {
    const resolvedTheme = theme ?? this.defaultTheme();
    const amountLabel =
      payload.amount !== undefined ? ` — $${payload.amount.toFixed(2)}` : '';
    const subject = `markPaid() error at "${payload.errorPhase}" — payout ${payload.payoutRequestId}${amountLabel}`;
    try {
      await this.mail.sendMail({
        from: this.buildFrom(resolvedTheme),
        to: 'paulo@regenta.ai',
        subject,
        html: adminMarkPaidErrorTemplate(payload, resolvedTheme),
      });
    } catch (err) {
      this.logger.error(
        `Failed to send markPaid error fallback email for payout ${payload.payoutRequestId}`,
        err,
      );
    }
  }

  async notifyAdminPaymentFailed(
    payload: AdminPaymentFailedPayload,
    theme?: EmailTheme,
  ): Promise<void> {
    const resolvedTheme = theme ?? this.defaultTheme();
    try {
      const adminEmails = await this.getAdminEmails();
      const subject = `Bill.com payment failed — ${payload.partnerName} ($${payload.amount.toFixed(2)})`;
      const html = adminPaymentFailedTemplate(payload, resolvedTheme);
      for (const email of adminEmails) {
        try {
          await this.mail.sendMail({
            from: this.buildFrom(resolvedTheme),
            to: email,
            subject,
            html,
          });
        } catch (err) {
          this.logger.error(
            `Failed to send admin payment failed email to ${email}`,
            err,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        'Failed to send admin payment failed notifications',
        err,
      );
    }
  }
}
