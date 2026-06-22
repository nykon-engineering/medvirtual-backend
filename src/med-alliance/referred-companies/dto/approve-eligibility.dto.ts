import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApproveEligibilityDto {
  @ApiProperty({
    example:
      'Client has been fully onboarded for 6+ months and is actively using the platform.',
  })
  @IsNotEmpty()
  @IsString()
  reason: string;
}
