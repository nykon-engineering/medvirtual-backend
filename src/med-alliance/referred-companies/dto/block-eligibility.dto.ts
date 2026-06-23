import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BlockEligibilityDto {
  @ApiProperty({
    example:
      'Referred company is an existing active MedVirtual client — commission not warranted.',
  })
  @IsNotEmpty()
  @IsString()
  reason: string;
}
