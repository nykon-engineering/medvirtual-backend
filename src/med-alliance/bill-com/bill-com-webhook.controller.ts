import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BillComPayoutService } from './bill-com-payout.service';

const TERMINAL_SUCCESS_STATUSES = new Set(['PAID', 'COMPLETED', 'SUCCESS']);

@ApiTags('webhooks')
@Controller('webhooks')
export class BillComWebhookController {
  private readonly logger = new Logger(BillComWebhookController.name);

  constructor(private readonly billComPayoutService: BillComPayoutService) {}

  @Post('bill-com')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Receive and process incoming Bill.com webhook events',
  })
  @ApiBody({
    description: 'Payload sent by Bill.com for payment events',
  })
  @ApiResponse({ status: 200, description: 'Webhook received' })
  async handleWebhook(@Body() payload: any): Promise<{ received: boolean }> {
    try {
      const eventType: string = payload?.eventType ?? payload?.type ?? '';
      const paymentId: string = payload?.data?.id ?? '';

      //here I'll check the x-bill-sha-signature header to verify authenticity 
      // Also I need to validate some datas, such as organizationID
      if (!paymentId) {
        this.logger.warn(
          'Bill.com webhook received with no payment ID, ignoring',
        );
        return { received: true };
      }

      if (
        eventType === 'payment.updated' &&
        TERMINAL_SUCCESS_STATUSES.has(payload?.data?.status)
      ) {
        await this.billComPayoutService.finalizeAsPaid(paymentId);
        return { received: true };
      }

      if (eventType === 'payment.failed') {
        const errorMsg: string =
          payload?.data?.errorMessage ??
          payload?.data?.error ??
          'Payment failed (no details provided)';
        await this.billComPayoutService.markAsFailed(paymentId, errorMsg);
        return { received: true };
      }

      this.logger.log(`Bill.com webhook event "${eventType}" ignored`);
    } catch (err) {
      // Never return non-200 to Bill.com — it would trigger retries for a potentially
      // already-processed event.
      this.logger.error('Unhandled error processing Bill.com webhook', err);
    }

    return { received: true };
  }
}
