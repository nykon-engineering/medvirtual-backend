import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  isString,
  IsString,
  ValidateNested,
} from 'class-validator';
import { filter } from 'rxjs';

export class filtersGetCandidatesDto {
  @IsString()
  field: string;

  @IsString()
  value: string;
}

export class GetCandidatesDto {
  @ApiProperty({ required: true, description: 'Virtual Assistant identifier' })
  @IsString()
  @IsNotEmpty()
  virtualAssistant: string;

  @ApiProperty({
    description: 'Array with names fields to show on return',
    type: [String],
    example: [
      'name',
      'id',
      'agent_status',
      'status',
      'stage',
      'country',
      'date_of_birth',
      'email',
    ],
  })
  @IsString({ each: true })
  properties: string[];

  @ApiProperty({
    description: 'Object with field and value to apply on search',
    type: [filtersGetCandidatesDto],
    example: [
      { field: 'pipeline', value: '99999999' },
      { field: 'stage', value: '99999999' },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => filtersGetCandidatesDto)
  filters: filtersGetCandidatesDto[];
}
