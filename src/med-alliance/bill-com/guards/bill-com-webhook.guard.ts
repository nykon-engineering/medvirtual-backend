import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class BillWebhookGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const signature = request.headers['x-bill-sha-signature'];
    
    if (!signature) {
      throw new UnauthorizedException('Missing signature header');
    }

    const secret = process.env.BILLCOM_WEBHOOK_SECRET;
    if (!secret) {
        throw new UnauthorizedException('Webhook secret not configured');
    }
    
    const rawBody = request.rawBody; 

    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    if (signature !== computedSignature) {
      throw new UnauthorizedException('Invalid signature');
    }

    return true;
  }
}