import { IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBusinessUnitDto {
  @ApiProperty({ description: 'Display name', example: 'MMVA' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({
    description: 'URL-safe slug (lowercase, hyphens only)',
    example: 'mmva',
  })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must be lowercase letters, numbers and hyphens only',
  })
  slug: string;
}
