import { PartialType } from '@nestjs/swagger';
import { CreateOrganizationDto } from './createOrganization.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUrl, IsEnum } from 'class-validator';
import { OrganizationRole } from '@prisma/client';

export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {
  @IsOptional()
  @IsEnum(OrganizationRole)
  @ApiProperty({
    required: false,
    description: 'Organization role (system admin only)',
    enum: OrganizationRole,
  })
  organization_role?: OrganizationRole;

  @IsOptional()
  @IsUrl()
  @ApiProperty({
    required: false,
    description: 'Signed document URL (system admin only)',
  })
  signed_document_url?: string;
}
