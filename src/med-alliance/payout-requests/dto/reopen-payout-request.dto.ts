import { IsIn } from 'class-validator';

export class ReopenPayoutRequestDto {
  @IsIn(['requested', 'under_review'])
  target_status: 'requested' | 'under_review';
}
