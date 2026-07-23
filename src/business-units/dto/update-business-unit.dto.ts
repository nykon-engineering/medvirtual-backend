import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

export class UpdateBusinessUnitDto {
  @ApiPropertyOptional({
    description: 'New display name',
    example: 'My Medical VA',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({
    description:
      'Legacy active/inactive flag on the BusinessUnit row itself. Distinct ' +
      'from is_visible — this does not gate app behavior (dropdowns, HubSpot ' +
      'intake, branding). Prefer is_visible for the Multi-BU activation flow.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({
    description:
      'Whether this BU is allowed to operate (visible in every dropdown, brand ' +
      'resolver, and email-branding list) vs dormant (known — e.g. discovered ' +
      'by the daily HubSpot sync cron — but not yet active). ' +
      'IMPORTANT SIDE EFFECT: flipping false→true (1) synchronously reactivates ' +
      'every Organization/USER/Candidate/AffiliateProfile row previously ' +
      'soft-deleted for this slug (deactivated_by_bu = <slug>), then ' +
      '(2) fires an async, fire-and-forget multi-object backfill pulling this ' +
      "BU's pre-existing HubSpot data (companies, contacts, virtual assistants, " +
      'growth partners) into the platform, upserted by hubspot_id, non-' +
      'destructive and idempotent. The backfill does not block the response. ' +
      'Flipping true→false only hides the BU going forward — it does NOT ' +
      'soft-delete related data (that cascade only happens via the cron\'s ' +
      'removal-reconcile step when a BU disappears from HubSpot entirely).',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_visible?: boolean;

  @ApiPropertyOptional({
    description: 'App brand primary color (hex), used for buttons/highlights/sidebar.',
    example: '#077999',
  })
  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX, {
    message: 'primary_color must be a valid hex color (e.g. #077999)',
  })
  primary_color?: string;

  @ApiPropertyOptional({
    description: 'App brand primary hover color (hex), used on hover states.',
    example: '#066685',
  })
  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX, {
    message: 'primary_hover must be a valid hex color (e.g. #066685)',
  })
  primary_hover?: string;

  @ApiPropertyOptional({
    description: 'App logo URL, shown in the sidebar/top bar for this brand.',
    example: 'https://staging.medvirtual.ai/logommva.png',
  })
  @IsOptional()
  @IsString()
  logo_url?: string;

  @ApiPropertyOptional({
    description: 'App favicon URL, shown in the browser tab for this brand.',
    example: 'https://staging.medvirtual.ai/faviconmmva.ico',
  })
  @IsOptional()
  @IsString()
  favicon_url?: string;

  @ApiPropertyOptional({
    description:
      'Candidate visibility pool this BU draws from. "non_medical" restricts ' +
      'this brand\'s clients to candidates in the non_medical pool; "medical" ' +
      '(default) applies no restriction — clients see every candidate. ' +
      'Today only Berry Virtual is "non_medical"; MedVirtual and MMVA are both ' +
      '"medical" and see the full candidate list.',
    enum: ['medical', 'non_medical'],
    example: 'medical',
  })
  @IsOptional()
  @IsIn(['medical', 'non_medical'])
  candidate_pool?: string;
}
