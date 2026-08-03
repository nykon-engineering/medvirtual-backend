import { IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Not surfaced in the app UI — Business Unit intake is HubSpot-only (see
 * GET /cron/sync-business-units). Kept for seed scripts, tests, and manual
 * recovery. The resulting row lands with is_visible=false and
 * candidate_pool="medical" by default; use PUT /business-units/:slug to set
 * branding/candidate_pool/is_visible afterwards.
 */
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
