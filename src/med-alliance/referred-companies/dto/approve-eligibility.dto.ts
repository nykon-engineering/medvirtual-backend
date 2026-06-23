import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApproveEligibilityDto {
  @ApiProperty({
    example:
      'Client has been fully onboarded for 6+ months and is actively using the platform.',
  })
  @IsNotEmpty()
  @IsString()
  reason: string;

  @ApiProperty({
    example: true,
    description:
      'When true, backfill commissions for all past paid invoices (detected → pending_admin_confirmation). When false, void past detected commissions and re-anchor eligibility_start_at to today.',
  })
  @IsBoolean()
  backfill: boolean;
}
