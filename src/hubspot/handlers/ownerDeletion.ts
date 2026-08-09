import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HandlerOwnerDeletion {
  constructor(private readonly prisma: PrismaService) {}

  async execute(event) {
    try {
      const ownerExists = await this.prisma.uSER.findUnique({
        where: {
          hubspot_id: String(event.objectId),
        },
        select: {
          id: true,
        },
      });
      if (!ownerExists) return;

      await this.prisma.uSER.delete({
        where: {
          id: ownerExists.id,
        },
      });
    } catch (error) {
      throw new BadRequestException('Error deleting owner', error);
    }
  }
}
