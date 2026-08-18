import { IsIn } from 'class-validator';

export class PingSessionActivityDto {
  @IsIn(['talent_pool', 'platform'])
  scope: 'talent_pool' | 'platform';
}
