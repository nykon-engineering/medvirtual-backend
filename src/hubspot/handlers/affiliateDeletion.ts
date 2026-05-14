import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AffiliateStatus } from '@prisma/client';

@Injectable()
export class HandlerAffiliateDeletion {
  constructor(private readonly prisma: PrismaService) {}

  async execute(event) {
    try {
      const affiliateExists = await this.prisma.affiliateProfile.findUnique({
        where: {
          hubspot_id: String(event.objectId),
        },
        include: {
          user: true,
        },
      });
      if (!affiliateExists) return;

      if (affiliateExists.user?.role === 'affiliate') {
        await this.prisma.affiliateProfile.update({
          where: {
            id: affiliateExists.id,
          },
          data: {
            status: AffiliateStatus.inactive,
            hubspot_id_before_deletion: affiliateExists.hubspot_id,
            hubspot_id: null,
          },
        });

        await this.prisma.uSER.update({
          where: {
            id: affiliateExists.user.id,
          },
          data: {
            status: 'inactive',
          },
        });
      } else {
        await this.prisma.affiliateProfile.update({
          where: {
            id: affiliateExists.id,
          },
          data: {
            status: AffiliateStatus.inactive,
            hubspot_id_before_deletion: affiliateExists.hubspot_id,
            hubspot_id: null,
          },
        });
      }
      
    } catch (error) {
      throw new BadRequestException('Error deleting affiliate', error);
    }
  }
}
