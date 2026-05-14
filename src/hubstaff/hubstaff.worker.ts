import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { HubstaffService } from './hubstaff.service';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '@nestjs/common';

@Processor('hubstaff-sync')
export class HubstaffWorker extends WorkerHost {
  private readonly logger = new Logger(HubstaffWorker.name);

  constructor(
    private readonly hubstaffService: HubstaffService,
    private readonly prisma: PrismaService,
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

      let updateCount = 0;
      let skipCount = 0;

      for (const member of members) {
        // member object contains 'email' and 'user_id'
        const email = member.email;
        const hubstaffUserId = String(member.user_id);

        if (!email) {
          skipCount++;
          continue;
        }

        const candidate = await this.prisma.candidate.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
        });

        if (candidate) {
          await this.prisma.candidate.update({
            where: { id: candidate.id },
            data: { hubstaff_id: hubstaffUserId },
          });
          updateCount++;
          this.logger.debug(`✅ Updated candidate ${candidate.id} with Hubstaff ID ${hubstaffUserId}`);
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
