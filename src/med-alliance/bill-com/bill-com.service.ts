import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { adminRememberMeExpiredTemplate } from '../notifications/templates/admin-remember-me-expired';

export interface CreateBillAndPaymentResponse {
  paymentId: string;
  billId: string;
  status: string;
  confirmationNumber: string;
  transactionNumber: string;
}

@Injectable()
export class BillComService {
  private readonly logger = new Logger(BillComService.name);
  private cachedSessionId: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  private requireEnv(): {
    username: string;
    password: string;
    organizationId: string;
    devKey: string;
    fundingAccountId: string;
    billBaseUrl: string;
  } {
    const username = process.env.BILLCOM_USERNAME;
    const password = process.env.BILLCOM_PASSWORD;
    const organizationId = process.env.BILLCOM_ORGANIZATION_ID;
    const devKey = process.env.BILLCOM_DEV_KEY;
    const fundingAccountId = process.env.BILLCOM_FUNDING_ACCOUNT_ID;
    const billBaseUrl = process.env.BILLCOM_BASE_URL;

    if (
      !username ||
      !password ||
      !organizationId ||
      !devKey ||
      !fundingAccountId ||
      !billBaseUrl
    ) {
      throw new InternalServerErrorException(
        'Bill.com credentials not configured. Set BILLCOM_USERNAME, BILLCOM_PASSWORD, BILLCOM_ORGANIZATION_ID, BILLCOM_DEV_KEY, BILLCOM_FUNDING_ACCOUNT_ID, BILLCOM_BASE_URL.',
      );
    }

    return {
      username,
      password,
      organizationId,
      devKey,
      fundingAccountId,
      billBaseUrl,
    };
  }

  private async login(): Promise<string> {
    const { username, password, organizationId, devKey, billBaseUrl } =
      this.requireEnv();

    const cred = await this.prisma.billComCredential.findUnique({
      where: { id: 'singleton' },
    });

    try {
      const response = await axios.post<{
        sessionId: string;
        organizationId: string;
        userId: string;
        trusted: boolean;
      }>(
        `${billBaseUrl}/login`,
        {
          username,
          password,
          organizationId,
          devKey,
          ...(cred?.rememberMeId && { rememberMeId: cred.rememberMeId }),
          ...(cred?.device && { device: cred.device }),
        },
        { headers: { 'Content-Type': 'application/json' }, timeout: 15000 },
      );
      this.cachedSessionId = response.data.sessionId;
      this.logger.log('Bill.com session refreshed');
      return this.cachedSessionId;
    } catch (err) {
      this.cachedSessionId = null;
      const axiosErr = err as AxiosError<any>;
      if (axiosErr.response?.data?.errorCode === 'BDC_1109') {
        this.logger.error(
          'Bill.com rememberMeId has expired (BDC_1109). Sending alert email.',
        );
        void this.notifyRememberMeIdExpired();
      }
      throw this.wrapError('login', err);
    }
  }

  private async notifyRememberMeIdExpired(): Promise<void> {
    try {
      await this.mail.sendMail({
        from: 'MedVirtual <noreply@medvirtual.ai>',
        to: 'paulo@regenta.ai',
        subject: '[Bill.com] rememberMeId expired — manual renewal required',
        html: adminRememberMeExpiredTemplate(),
      });
    } catch (err) {
      this.logger.error('Failed to send rememberMeId expiry alert email', err);
    }
  }

  private async ensureSession(): Promise<string> {
    if (this.cachedSessionId) return this.cachedSessionId;
    return this.login();
  }

  private invalidateSession(): void {
    this.cachedSessionId = null;
  }

  private wrapError(operation: string, err: unknown): BadGatewayException {
    const axiosErr = err as AxiosError<any>;
    const responseData = axiosErr.response?.data;
    if (responseData) {
      this.logger.error(
        `Bill.com ${operation} raw error response: ${JSON.stringify(responseData)}`,
      );
    }
    const message =
      responseData?.message ??
      responseData?.error ??
      responseData?.response_message ??
      (Array.isArray(responseData?.errors)
        ? responseData.errors
            .map((e: any) => e.message ?? JSON.stringify(e))
            .join('; ')
        : undefined) ??
      axiosErr.message ??
      'Unknown Bill.com error';
    this.logger.error(`Bill.com ${operation} failed: ${message}`);
    return new BadGatewayException(`Bill.com ${operation} failed: ${message}`);
  }

  private async callWithSessionRetry<T>(
    operation: string,
    fn: (sessionId: string, devKey: string) => Promise<T>,
  ): Promise<T> {
    const { devKey } = this.requireEnv();
    const sessionId = await this.ensureSession();

    try {
      return await fn(sessionId, devKey);
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 401) {
        this.logger.warn('Bill.com session expired, re-authenticating...');
        this.invalidateSession();
        const freshSessionId = await this.login();
        try {
          return await fn(freshSessionId, devKey);
        } catch (retryErr) {
          throw this.wrapError(operation, retryErr);
        }
      }
      throw this.wrapError(operation, err);
    }
  }

  async createBillAndPayment(params: {
    vendorId: string;
    amount: number;
    processDate: string;
    description: string;
  }): Promise<CreateBillAndPaymentResponse> {
    const { vendorId, amount, processDate, description } = params;
    const { fundingAccountId, billBaseUrl } = this.requireEnv();

    return this.callWithSessionRetry(
      'createBillAndPayment',
      async (sessionId, devKey) => {
        const response = await axios.post<{
          id: string;
          billId?: string;
          billIds?: string[];
          status: string;
          confirmationNumber: string;
          transactionNumber: string;
        }>(
          `${billBaseUrl}/payments`,
          {
            vendorId,
            amount,
            processDate,
            description: description.substring(0, 70), // Bill.com may have a max length for description
            fundingAccount: {
              type: 'BANK_ACCOUNT',
              id: fundingAccountId,
            },
            processingOptions: {
              createBill: true,
              requestPayFaster: false,
              requestCheckDeliveryType: 'STANDARD',
            },
          },
          {
            headers: {
              'Content-Type': 'application/json',
              devKey,
              sessionId,
            },
            timeout: 15000,
          },
        );

        const billId = response.data.billId ?? response.data.billIds?.[0] ?? '';

        return {
          paymentId: response.data.id,
          billId,
          status: response.data.status,
          confirmationNumber: response.data.confirmationNumber, // Assuming payment ID can serve as confirmation number
          transactionNumber: response.data.transactionNumber,
        };
      },
    );
  }
}
