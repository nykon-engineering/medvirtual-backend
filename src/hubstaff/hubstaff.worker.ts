import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { HubstaffService } from './hubstaff.service';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '@nestjs/common';
import { HubspotService } from '../hubspot/hubspot.service';

/**
 * The only fields this sync reads off a HubSpot candidate: `vaid` to match against
 * the Hubstaff profile and `hs_object_id` to find our local Candidate row. Fetching
 * the full candidate dictionary here would pull ~54 properties per record and throw
 * all but two away.
 */
const IDENTITY_PROPERTIES = ['vaid', 'hs_object_id'];

@Processor('hubstaff-sync')
export class HubstaffWorker extends WorkerHost {
  private readonly logger = new Logger(HubstaffWorker.name);

  constructor(
    private readonly hubstaffService: HubstaffService,
    private readonly prisma: PrismaService,
    private readonly hubspotService: HubspotService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case 'sync-hubstaff-members':
        return await this.handleSyncMembers();
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async handleSyncMembers() {
    this.logger.log('🚀 Starting Hubstaff members sync...');

    try {
      const members = await this.hubstaffService.getOrganizationMembers();
      this.logger.log(`📡 Fetched ${members.length} members from Hubstaff`);

      // Extract all non-empty VA IDs from Hubstaff members
      const vaIds: string[] = [];
      const memberVaIdMap = new Map<string, string>(); // Maps member user_id to VA ID

      for (const member of members) {
        const customFields = member.profile?.custom_fields ?? {};
        const vaIdKey = Object.keys(customFields).find(key => key.toUpperCase().includes('VA ID'));
        const vaId = vaIdKey ? customFields[vaIdKey]?.trim() : null;

        if (vaId) {
          vaIds.push(vaId);
          memberVaIdMap.set(String(member.user_id), vaId);
        }
      }

      this.logger.log(`📡 Found ${vaIds.length} members with VA ID profiles`);

      if (vaIds.length === 0) {
        this.logger.log('🏁 Sync completed. No members with VA ID profiles found.');
        return { updateCount: 0, skipCount: members.length };
      }

      this.logger.log('📡 Fetching matched candidates from HubSpot...');
      const hubspotResult = await this.hubspotService.fetchPropertiesAndCandidates(
        vaIds,
        IDENTITY_PROPERTIES,
      );
      this.logger.log(`HubSpot candidates fetched: ${hubspotResult.candidates.length}`);

      let updateCount = 0;
      let skipCount = 0;

      for (const member of members) {
        const hubstaffUserId = String(member.user_id);
        const vaId = memberVaIdMap.get(hubstaffUserId);

        if (!vaId) {
          skipCount++;
          continue;
        }

        const matchedCandidate = hubspotResult.candidates.find(c => {
          const hubspotVaId = c.properties?.vaid;
          return hubspotVaId && hubspotVaId.trim() === vaId;
        });

        if (!matchedCandidate) {
          skipCount++;
          continue;
        }

        const hubspotId = matchedCandidate.id || matchedCandidate.properties?.hs_object_id;
        if (!hubspotId) {
          skipCount++;
          continue;
        }

        const candidate = await this.prisma.candidate.findUnique({
          where: { hubspot_id: String(hubspotId) },
        });

        if (candidate) {
          if (candidate.hubstaff_id !== hubstaffUserId) {
            const existingWithSameHubstaffId = await this.prisma.candidate.findUnique({
              where: { hubstaff_id: hubstaffUserId },
            });

            if (existingWithSameHubstaffId) {
              await this.prisma.candidate.update({
                where: { id: existingWithSameHubstaffId.id },
                data: { hubstaff_id: null },
              });
              this.logger.debug(`Cleared hubstaff_id from candidate ${existingWithSameHubstaffId.id} to avoid unique constraint conflict`);
            }

            await this.prisma.candidate.update({
              where: { id: candidate.id },
              data: { hubstaff_id: hubstaffUserId },
            });

            updateCount++;
            this.logger.debug(`✅ Updated candidate ${candidate.id} with Hubstaff ID ${hubstaffUserId}`);
          } else {
            skipCount++;
          }
        } else {
          skipCount++;
        }
      }

      this.logger.log(`🏁 Sync completed. Updated: ${updateCount}, Skipped/Not found: ${skipCount}`);
      return { updateCount, skipCount };
    } catch (error) {
      this.logger.error('❌ Hubstaff members sync failed:', error.stack);
      throw error;
    }
  }
}
