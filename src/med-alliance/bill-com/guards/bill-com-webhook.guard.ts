import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class BillWebhookGuard implements CanActivate {
  private readonly logger = new Logger(BillWebhookGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const signature = request.headers['x-bill-sha-signature'];

    if (!signature) {
      this.logger.warn(
        'Bill.com webhook rejected: missing x-bill-sha-signature header',
      );
      throw new UnauthorizedException('Missing signature header');
    }

    const secret = process.env.BILLCOM_WEBHOOK_SECRET;
    if (!secret) {
      this.logger.error(
        'Bill.com webhook rejected: BILLCOM_WEBHOOK_SECRET env var is not set',
      );
      throw new UnauthorizedException('Webhook secret not configured');
    }

    const rawBody: Buffer | undefined = request.rawBody;
    if (!rawBody) {
      this.logger.error(
        'Bill.com webhook rejected: rawBody is missing — check express.json verify config',
      );
      throw new UnauthorizedException('Raw body unavailable');
    }

    // Bill.com signs the raw body and encodes the result as Base64
    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64');

    this.logger.debug(`Received signature: ${signature}`);
    this.logger.debug(`Computed signature: ${computedSignature}`);

    if (signature !== computedSignature) {
      this.logger.warn(
        `Bill.com webhook rejected: signature mismatch. Received="${signature}" Computed="${computedSignature}"`,
      );
      throw new UnauthorizedException('Invalid signature');
    }

    return true;
  }
}
