import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReopenPayoutRequestDto {
  @ApiProperty({
    description: 'Target status to reopen the payout request to',
    enum: ['requested', 'under_review'],
    example: 'requested',
  })
  @IsIn(['requested', 'under_review'])
  target_status: 'requested' | 'under_review';
}
