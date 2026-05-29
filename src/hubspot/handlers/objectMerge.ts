import { BadRequestException, Injectable } from '@nestjs/common';

import {
  mapDbToHubspot,
  mapHubspotToDb,
} from '../../common/utils/hubspot.util';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HandlerObjectMerge {
  constructor(private readonly prisma: PrismaService) {}

  private mergeCandidateData(primary: any, merged: any): Partial<any> {
    const mergedAsHubspot = mapDbToHubspot(merged);

    const dbMapped = mapHubspotToDb(mergedAsHubspot);

    const updateData: Record<string, any> = {};

    for (const [key, value] of Object.entries(dbMapped)) {
      const primaryValue = primary[key];

      if (
        (primaryValue === null ||
          primaryValue === undefined ||
          primaryValue === '') &&
        value
      ) {
        updateData[key] = value;
      }
    }

    return updateData;
  }

  async execute(event) {
    try {
      const primaryCandidate = await this.prisma.candidate.findUnique({
        where: { hubspot_id: String(event.primaryObjectId) },
      });
      if (!primaryCandidate) {
        throw new BadRequestException(
          `Primary candidate hubspotId=${event.primaryObjectId} not found in database.`,
        );
      }

      const otherMergedIds = event.mergedObjectIds
        .map((id) => String(id))
        .filter((id) => id !== String(event.primaryObjectId));

      const mergedCandidates = await this.prisma.candidate.findMany({
        where: {
          hubspot_id: { in: otherMergedIds },
        },
      });

      if (mergedCandidates.length === 0) {
        throw new BadRequestException(
          `No merged companies found with the provided HubSpot IDs.`,
        );
      }

      let dataToUpdate: Record<string, any> = {};
      for (const merged of mergedCandidates) {
        const partialUpdate = this.mergeCandidateData(primaryCandidate, merged);

        dataToUpdate = {
          ...dataToUpdate,
          ...partialUpdate,
        };
      }

      if (Object.keys(dataToUpdate).length > 0) {
        await this.prisma.candidate.update({
          where: { hubspot_id: String(event.primaryObjectId) },
          data: dataToUpdate,
        });
      }

      await this.prisma.candidate.update({
        where: { hubspot_id: String(event.primaryObjectId) },
        data: {
          hubspot_id: String(event.newObjectId),
        },
      });

      await this.prisma.candidate.deleteMany({
        where: {
          hubspot_id: { in: otherMergedIds },
        },
      });
    } catch (error) {
      throw new BadRequestException(`HandlerObjectMerge: ${error.message}`);
    }
  }
}
