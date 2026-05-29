import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import axios, { AxiosError } from 'axios';

interface LoginResponse {
  sessionId: string;
  organizationId: string;
  userId: string;
  trusted: boolean;
}

export interface CreateBillResponse {
  id: string;
  paymentStatus: string;
  approvalStatus: string;
}
@Injectable()
export class BillComService {
  private readonly logger = new Logger(BillComService.name);
  private cachedSessionId: string | null = null;

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
    const billBaseUrl = process.env.BILL_COM_BASE_URL;

    if (
      !username ||
      !password ||
      !organizationId ||
      !devKey ||
      !fundingAccountId ||
      !billBaseUrl
    ) {
      throw new InternalServerErrorException(
        'Bill.com credentials not configured. Set BILLCOM_USERNAME, BILLCOM_PASSWORD, BILLCOM_ORGANIZATION_ID, BILLCOM_DEV_KEY, BILLCOM_FUNDING_ACCOUNT_ID, BILL_COM_BASE_URL.',
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

    try {
      const response = await axios.post<LoginResponse>(
        `${billBaseUrl}/login`,
        { username, password, organizationId, devKey },
        { headers: { 'Content-Type': 'application/json' }, timeout: 15000 },
      );
      this.cachedSessionId = response.data.sessionId;
      this.logger.log('Bill.com session refreshed');
      return this.cachedSessionId;
    } catch (err) {
      this.cachedSessionId = null;
      throw this.wrapError('login', err);
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
    const message =
      axiosErr.response?.data?.message ??
      axiosErr.response?.data?.error ??
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

  async createBill(params: {
    vendorId: string;
    dueDate: string;
    amount: number;
    description: string;
    invoiceNumber: string;
    invoiceDate: string;
    billLineItems: { description: string }[];
  }): Promise<CreateBillResponse> {
    const {
      vendorId,
      dueDate,
      amount,
      description,
      invoiceNumber,
      invoiceDate,
    } = params;

    return this.callWithSessionRetry(
      'createBill',
      async (sessionId, devKey) => {
        const { billBaseUrl } = this.requireEnv();
        const response = await axios.post<CreateBillResponse>(
          `${billBaseUrl}/bills`,
          {
            vendorId,
            dueDate,
            description,
            billLineItems: params.billLineItems, //the total amount will be the total of the line items
            invoice: { invoiceNumber, invoiceDate },
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
        return {
          id: response.data.id,
          paymentStatus: response.data.paymentStatus,
          approvalStatus: response.data.approvalStatus,
        };
      },
    );
  }

  async createPayment(params: {
    vendorId: string;
    billId: string;
    amount: number;
    processDate: string;
  }): Promise<{ paymentId: string; status: string }> {
    const { vendorId, billId, amount, processDate } = params;
    const { fundingAccountId, billBaseUrl } = this.requireEnv();

    return this.callWithSessionRetry(
      'createPayment',
      async (sessionId, devKey) => {
        const response = await axios.post<{ id: string; status: string }>(
          `${billBaseUrl}/payments`,
          {
            vendorId,
            billId,
            processDate,
            fundingAccount: {
              type: 'BANK_ACCOUNT',
              id: fundingAccountId,
            },
            amount,
            processingOptions: {
              requestPayFaster: false,
              createBill: false,
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
        return { paymentId: response.data.id, status: response.data.status };
      },
    );
  }
}
