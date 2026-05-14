import { Controller, Post } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Hubstaff')
@Controller('hubstaff')
export class HubstaffController {
  constructor(
    @InjectQueue('hubstaff-sync') private readonly hubstaffSyncQueue: Queue,
  ) {}

  @Post('sync')
  @ApiOperation({ summary: 'Trigger Hubstaff members sync' })
  @ApiResponse({ status: 200, description: 'Sync event triggered successfully' })
  async triggerSync() {
    await this.hubstaffSyncQueue.add('sync-hubstaff-members', {
      timestamp: new Date().toISOString(),
    });
    return { message: 'Hubstaff members sync event triggered successfully' };
  }
}
