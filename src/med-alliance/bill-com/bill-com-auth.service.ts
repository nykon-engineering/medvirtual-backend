import { Injectable } from '@nestjs/common';
import { BillComLoginResult, BillComService } from './bill-com.service';
import { BillComNoDeviceException } from './bill-com-no-device.exception';

export type BillComNextStep = 'proceed' | 'mfa_challenge' | 'no_device_configured';

export interface BillComNextStepResult {
  nextStep: BillComNextStep;
  challengeId?: string;
}

@Injectable()
export class BillComAuthService {
  constructor(private readonly billComService: BillComService) {}

  /**
   * Determines the next login step by asking Bill.com directly whether a
   * device is registered — Bill.com has no "list devices" endpoint, so this
   * is inferred by attempting the MFA challenge itself: success means a
   * device exists (the challenge is already in flight, its challengeId is
   * reused so the frontend doesn't trigger a second one), and BDC_1354
   * means none does.
   */
  async determineNextStep(
    userId: string,
    loginResult: BillComLoginResult,
  ): Promise<BillComNextStepResult> {
    if (loginResult.trusted) return { nextStep: 'proceed' };

    try {
      const { challengeId } = await this.billComService.requestMfaChallenge(
        userId,
        loginResult.sessionId,
      );
      return { nextStep: 'mfa_challenge', challengeId };
    } catch (err) {
      if (err instanceof BillComNoDeviceException) {
        return { nextStep: 'no_device_configured' };
      }
      throw err;
    }
  }
}
