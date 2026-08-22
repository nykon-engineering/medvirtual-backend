import { Injectable } from '@nestjs/common';
import { HandlerDealCreation } from '../hubspot/handlers/dealCreation';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DealsQueueConsumerService {
  constructor(
    private readonly dealCreation: HandlerDealCreation,
    private readonly prisma: PrismaService,
  ) {}

  async handleMessage(body: string): Promise<void> {
    let payload: any = JSON.parse(body);

    if (typeof payload === 'string') {
      payload = JSON.parse(payload);
    }

    const type = payload.Type?.trim();

    switch (type) {
      case 'CREATE_DEAL_STAFF':
        console.log(`Creating staff for deal ${payload.objectId}`);
        await this.dealCreation.execute(payload);
        break;

      case 'DEACTIVATE_STAFF':
        console.log(`Deactivating staff for deal ${payload.objectId}`);
        await this.prisma.staff.update({
          where: { hubspot_id: String(payload.objectId) },
          data: { status: 'terminated' },
        });
        break;

      case 'REACTIVATE_STAFF':
        console.log(`Reactivating staff for deal ${payload.objectId}`);
        await this.prisma.staff.update({
          where: { hubspot_id: String(payload.objectId) },
          data: { status: 'active' },
        });
        break;

      default:
        console.warn('Event not handled:', payload);
        break;
    }
  }
}
