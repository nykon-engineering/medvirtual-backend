import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { BillComSessionRequiredException } from './bill-com-session-required.exception';
import { BillComAlreadyEnrolledException } from './bill-com-already-enrolled.exception';
import { BillComNoDeviceException } from './bill-com-no-device.exception';

export interface CreateBillAndPaymentResponse {
  paymentId: string;
  billId: string;
  status: string;
  confirmationNumber: string;
  transactionNumber: string;
}

export interface BillComLoginResult {
  sessionId: string;
  trusted: boolean;
}

// TODO(verify): confirm real Bill.com endpoint for "add phone for MFA setup"
// against live API docs/sandbox. Per bill.com support this is POST /mfa/setup
// (distinct from /mfa/setup/validate used to validate the code).
const BILLCOM_ADD_PHONE_ENDPOINT = '/mfa/setup';

// 4 hours is a conservative TTL for Bill.com sessions. In practice, they may
// last longer, but this is a correctness backstop for the retry-on-401 logic.
const SESSION_TTL_MS = 240 * 60 * 1000;

@Injectable()
export class BillComService {
  private readonly logger = new Logger(BillComService.name);

  constructor(private readonly prisma: PrismaService) {}

  private requireEnv(): {
    organizationId: string;
    devKey: string;
    fundingAccountId: string;
    billBaseUrl: string;
  } {
    const organizationId = process.env.BILLCOM_ORGANIZATION_ID;
    const devKey = process.env.BILLCOM_DEV_KEY;
    const fundingAccountId = process.env.BILLCOM_FUNDING_ACCOUNT_ID;
    const billBaseUrl = process.env.BILLCOM_BASE_URL;

    if (!organizationId || !devKey || !fundingAccountId || !billBaseUrl) {
      throw new InternalServerErrorException(
        'Bill.com configuration missing. Set BILLCOM_ORGANIZATION_ID, BILLCOM_DEV_KEY, BILLCOM_FUNDING_ACCOUNT_ID, BILLCOM_BASE_URL.',
      );
    }

    return { organizationId, devKey, fundingAccountId, billBaseUrl };
  }

  private wrapError(operation: string, err: unknown): BadGatewayException {
    const axiosErr = err as AxiosError<any>;
    const responseData = axiosErr.response?.data;
    if (responseData) {
      this.logger.error(
        `Bill.com ${operation} raw error response: ${JSON.stringify(responseData)}`,
      );
    }
    const errorsArray = Array.isArray(responseData)
      ? responseData
      : Array.isArray(responseData?.errors)
        ? responseData.errors
        : undefined;
    const message =
      responseData?.message ??
      responseData?.error ??
      responseData?.response_message ??
      (errorsArray
        ? errorsArray.map((e: any) => e.message ?? JSON.stringify(e)).join('; ')
        : undefined) ??
      axiosErr.message ??
      'Unknown Bill.com error';
    this.logger.error(`Bill.com ${operation} failed: ${message}`);
    return new BadGatewayException(`Bill.com ${operation} failed: ${message}`);
  }

  /**
   * BDC_5324 ("Mfa action blocked") on /mfa/setup means Bill.com's own
   * state already has a phone/device registered for this org/user — our
   * local billcom_device column can be null (e.g. a partial flow, or a
   * setup that succeeded on Bill.com's side without our write completing)
   * while Bill.com still considers the account enrolled. This is narrowly
   * scoped to BDC_5324 only: BDC_1570 ("Shield Service Errors") is Bill.com's
   * discretionary fraud/risk service and is not a reliable "already
   * enrolled" signal, so it must keep surfacing as a normal error.
   */
  private isAlreadyEnrolledError(err: unknown): boolean {
    const axiosErr = err as AxiosError<any>;
    const responseData = axiosErr.response?.data;
    const errorsArray = Array.isArray(responseData)
      ? responseData
      : Array.isArray(responseData?.errors)
        ? responseData.errors
        : undefined;
    return Boolean(errorsArray?.some((e: any) => e?.code === 'BDC_5324'));
  }

  /**
   * BDC_1354 ("Specified 2-Step Verification phone is not setup or is
   * invalid") on /mfa/challenge means Bill.com has no MFA device on file
   * for this user at all — confirmed empirically against the stage
   * sandbox. This is the signal used to skip our own phone-collection UI
   * and instead direct the user to configure MFA directly in Bill.com.
   */
  private isNoDeviceError(err: unknown): boolean {
    const axiosErr = err as AxiosError<any>;
    const responseData = axiosErr.response?.data;
    const errorsArray = Array.isArray(responseData)
      ? responseData
      : Array.isArray(responseData?.errors)
        ? responseData.errors
        : undefined;
    return Boolean(errorsArray?.some((e: any) => e?.code === 'BDC_1354'));
  }

  /**
   * Resolves the device label used for Bill.com's MFA-trust mechanism.
   * Per Bill.com docs, `device` is not returned by their API — it's any
   * caller-chosen string used to identify the device. This only *reads/
   * generates* the label; it is intentionally NOT persisted here. Bill.com
   * does not consider a device trusted until the phone MFA setup is actually
   * confirmed (validatePhoneForMfaSetup), so persisting early left
   * billcom_device populated for devices Bill.com never finished trusting —
   * causing determineNextStep to skip straight to mfa_challenge on a later
   * attempt and get BDC_5324 ("Mfa action blocked") in a loop.
   */
  private async resolveDeviceLabel(userId: string): Promise<string> {
    const user = await this.prisma.uSER.findUniqueOrThrow({
      where: { id: userId },
      select: { billcom_device: true, email: true },
    });
    return user.billcom_device ?? `MedVirtual Admin - ${user.email}`;
  }

  /**
   * BDC_5324 on addPhoneForMfaSetup means Bill.com already has a trusted
   * device for this user (see isAlreadyEnrolledError) — unlike the early
   * write this codebase deliberately avoids elsewhere, this is a confirmed
   * signal from Bill.com, not an optimistic guess. Persisting it here lets
   * determineNextStep skip phone_setup on the next login.
   */
  async markDeviceAlreadyEnrolled(userId: string): Promise<void> {
    const device = await this.resolveDeviceLabel(userId);
    await this.prisma.uSER.update({
      where: { id: userId },
      data: { billcom_device: device },
    });
  }

  /**
   * Signs the admin into Bill.com with their own credentials. Only a
   * `trusted: true` response is immediately usable for payments — that
   * session is persisted to billcom_session_id/billcom_session_expires.
   * A `trusted: false` response is transient scaffolding for the MFA/phone
   * flow and is held only in billcom_pending_session_id until
   * validateMfaChallenge confirms it.
   */
  async login(
    userId: string,
    credentials: { username: string; password: string },
  ): Promise<BillComLoginResult> {
    const { organizationId, devKey, billBaseUrl } = this.requireEnv();
    const user = await this.prisma.uSER.findUniqueOrThrow({
      where: { id: userId },
      select: { billcom_remember_me_id: true, billcom_device: true },
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
          username: credentials.username,
          password: credentials.password,
          organizationId,
          devKey,
          ...(user.billcom_remember_me_id && {
            rememberMeId: user.billcom_remember_me_id,
          }),
          ...(user.billcom_device && { device: user.billcom_device }),
        },
        { headers: { 'Content-Type': 'application/json' }, timeout: 15000 },
      );

      const { sessionId, trusted } = response.data;

      if (trusted) {
        await this.prisma.uSER.update({
          where: { id: userId },
          data: {
            billcom_session_id: sessionId,
            billcom_session_expires: new Date(Date.now() + SESSION_TTL_MS),
            billcom_pending_session_id: null,
          },
        });
      } else {
        await this.prisma.uSER.update({
          where: { id: userId },
          data: { billcom_pending_session_id: sessionId },
        });
      }

      return { sessionId, trusted };
    } catch (err) {
      throw this.wrapError('login', err);
    }
  }

  async requestMfaChallenge(
    userId: string,
    sessionId: string,
  ): Promise<{ challengeId: string }> {
    const { devKey, billBaseUrl } = this.requireEnv();
    try {
      const response = await axios.post<{ challengeId: string }>(
        `${billBaseUrl}/mfa/challenge`,
        {},
        {
          headers: { 'Content-Type': 'application/json', devKey, sessionId },
          timeout: 15000,
        },
      );
      return { challengeId: response.data.challengeId };
    } catch (err) {
      if (this.isNoDeviceError(err)) {
        throw new BillComNoDeviceException();
      }
      throw this.wrapError('requestMfaChallenge', err);
    }
  }

  /**
   * Validates the MFA code. The sessionId used above is already the
   * authenticated session — Bill.com just accepted the code on it. The
   * returned rememberMeId is NOT proof for *this* session; per Bill.com's
   * contract it "needs to be used on login", i.e. it's for the *next*
   * login, to skip MFA next time. So: persist rememberMeId/device for
   * future logins, and persist sessionId itself as the trusted session
   * right now — no second /login call.
   */
  async validateMfaChallenge(
    userId: string,
    sessionId: string,
    challengeId: string,
    token: string,
  ): Promise<BillComLoginResult> {
    const { devKey, billBaseUrl } = this.requireEnv();
    const device = await this.resolveDeviceLabel(userId);

    let rememberMeId: string;
    try {
      const response = await axios.post<{ rememberMeId: string }>(
        `${billBaseUrl}/mfa/challenge/validate`,
        { challengeId, token, device, rememberMe: false },
        {
          headers: { 'Content-Type': 'application/json', devKey, sessionId },
          timeout: 15000,
        },
      );
      rememberMeId = response.data.rememberMeId;
    } catch (err) {
      throw this.wrapError('validateMfaChallenge', err);
    }

    await this.prisma.uSER.update({
      where: { id: userId },
      data: {
        billcom_remember_me_id: rememberMeId,
        billcom_device: device,
        billcom_session_id: sessionId,
        billcom_session_expires: new Date(Date.now() + SESSION_TTL_MS),
        billcom_pending_session_id: null,
      },
    });

    return { sessionId, trusted: true };
  }

  /**
   * Per Bill.com's documented contract for this endpoint (phone, type,
   * deprecated primary only), `device` is not an accepted field here — it
   * only applies to /login and MFA challenge validation, once Bill.com has
   * already issued a device identity. Sending it on this call (the one that
   * *creates* that identity) doesn't match the documented contract and is a
   * plausible trigger for Bill.com's Shield risk service rejecting the call.
   */
  async addPhoneForMfaSetup(
    userId: string,
    sessionId: string,
    phone: string,
  ): Promise<{ setupId: string }> {
    const { devKey, billBaseUrl } = this.requireEnv();

    try {
      const response = await axios.post<{ setupId: string }>(
        `${billBaseUrl}${BILLCOM_ADD_PHONE_ENDPOINT}`,
        { phone, type: 'TEXT' },
        {
          headers: { 'Content-Type': 'application/json', devKey, sessionId },
          timeout: 15000,
        },
      );
      return { setupId: response.data.setupId };
    } catch (err) {
      if (this.isAlreadyEnrolledError(err)) {
        throw new BillComAlreadyEnrolledException();
      }
      throw this.wrapError('addPhoneForMfaSetup', err);
    }
  }

  /**
   * Confirms the phone MFA setup. This alone does not yield a trusted
   * session — per Bill.com's workflow, it must be followed by the regular
   * MFA challenge/validate pair (now using the newly-registered device).
   * billcom_device is only persisted here, on confirmed SUCCESS — this is
   * the sole write path for that field, so determineNextStep never treats a
   * device as trusted unless Bill.com actually confirmed it.
   */
  async validatePhoneForMfaSetup(
    userId: string,
    sessionId: string,
    setupId: string,
    token: string,
  ): Promise<{ status: string }> {
    const { devKey, billBaseUrl } = this.requireEnv();
    const device = await this.resolveDeviceLabel(userId);

    try {
      const response = await axios.post<{ status: string }>(
        `${billBaseUrl}/mfa/setup/validate`,
        { setupId, type: 'TEXT', token },
        {
          headers: { 'Content-Type': 'application/json', devKey, sessionId },
          timeout: 15000,
        },
      );

      const { status } = response.data;
      if (status === 'SUCCESS') {
        await this.prisma.uSER.update({
          where: { id: userId },
          data: { billcom_device: device },
        });
      }

      return { status };
    } catch (err) {
      throw this.wrapError('validatePhoneForMfaSetup', err);
    }
  }

  async hasValidSession(userId: string): Promise<boolean> {
    const user = await this.prisma.uSER.findUniqueOrThrow({
      where: { id: userId },
      select: { billcom_session_id: true, billcom_session_expires: true },
    });
    return Boolean(
      user.billcom_session_id &&
      user.billcom_session_expires &&
      user.billcom_session_expires.getTime() > Date.now(),
    );
  }

  private async callWithSessionRetry<T>(
    userId: string,
    operation: string,
    fn: (sessionId: string, devKey: string) => Promise<T>,
  ): Promise<T> {
    const { devKey } = this.requireEnv();
    const user = await this.prisma.uSER.findUniqueOrThrow({
      where: { id: userId },
      select: { billcom_session_id: true, billcom_session_expires: true },
    });

    const hasValid =
      user.billcom_session_id &&
      user.billcom_session_expires &&
      user.billcom_session_expires.getTime() > Date.now();

    if (!hasValid) {
      throw new BillComSessionRequiredException();
    }

    try {
      return await fn(user.billcom_session_id as string, devKey);
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 401) {
        this.logger.warn(
          `Bill.com session expired for user ${userId}, invalidating.`,
        );
        await this.prisma.uSER.update({
          where: { id: userId },
          data: { billcom_session_id: null, billcom_session_expires: null },
        });
        throw new BillComSessionRequiredException();
      }
      throw this.wrapError(operation, err);
    }
  }

  async createBillAndPayment(
    userId: string,
    params: {
      vendorId: string;
      amount: number;
      processDate: string;
      description: string;
    },
  ): Promise<CreateBillAndPaymentResponse> {
    const { vendorId, amount, processDate, description } = params;
    const { fundingAccountId, billBaseUrl } = this.requireEnv();

    return this.callWithSessionRetry(
      userId,
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
          confirmationNumber: response.data.confirmationNumber,
          transactionNumber: response.data.transactionNumber,
        };
      },
    );
  }
}
