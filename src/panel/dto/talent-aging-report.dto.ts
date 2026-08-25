import { ApiProperty } from '@nestjs/swagger';

export class TalentAgingBucketDto {
  @ApiProperty({ enum: ['0-30', '31-60', '61-90', '90+'] })
  bucket: '0-30' | '31-60' | '61-90' | '90+';

  @ApiProperty()
  count: number;
}

export class TalentAgingCandidateRowDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  hubspot_id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  position: string;

  @ApiProperty({ enum: ['Full-Time', 'Part-Time'] })
  employmentType: 'Full-Time' | 'Part-Time';

  @ApiProperty()
  pipeline_status: string;

  @ApiProperty()
  daysInPool: number;

  @ApiProperty({ enum: ['0-30', '31-60', '61-90', '90+'] })
  bucket: '0-30' | '31-60' | '61-90' | '90+';

  @ApiProperty()
  createdAt: string;
}

export class TalentAgingReportDto {
  @ApiProperty({ type: [TalentAgingBucketDto] })
  buckets: TalentAgingBucketDto[];

  @ApiProperty({ type: [TalentAgingCandidateRowDto] })
  candidates: TalentAgingCandidateRowDto[];
}
