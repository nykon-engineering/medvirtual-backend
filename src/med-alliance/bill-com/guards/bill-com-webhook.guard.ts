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

    this.logger.debug(
      `Incoming headers: ${JSON.stringify(Object.keys(request.headers))}`,
    );
    this.logger.debug(`x-bill-sha-signature present: ${!!signature}`);

    if (!signature) {
      this.logger.warn('Bill.com webhook rejected: missing x-bill-sha-signature header');
      throw new UnauthorizedException('Missing signature header');
    }

    const secret = process.env.BILLCOM_WEBHOOK_SECRET;
    if (!secret) {
      this.logger.error('Bill.com webhook rejected: BILLCOM_WEBHOOK_SECRET env var is not set');
      throw new UnauthorizedException('Webhook secret not configured');
    }

    const rawBody = request.rawBody;
    this.logger.debug(
      `rawBody type: ${typeof rawBody}, value: ${rawBody === undefined ? 'undefined' : rawBody === null ? 'null' : 'present'}`,
    );

    if (!rawBody) {
      this.logger.error('Bill.com webhook rejected: rawBody is missing — check express.json verify config');
      throw new UnauthorizedException('Raw body unavailable');
    }

    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    this.logger.debug(`Received signature:  ${signature}`);
    this.logger.debug(`Computed signature:  ${computedSignature}`);

    if (signature !== computedSignature) {
      this.logger.warn(
        `Bill.com webhook rejected: signature mismatch. Received="${signature}" Computed="${computedSignature}"`,
      );
      throw new UnauthorizedException('Invalid signature');
    }

    return true;
  }
}
