import { ApiProperty } from '@nestjs/swagger';

export class CandidateEndorsementRowDto {
  @ApiProperty()
  candidateId: string;

  @ApiProperty()
  candidateName: string;

  @ApiProperty({
    description:
      'Total number of times this candidate was endorsed in the period',
  })
  endorsementCount: number;

  @ApiProperty({
    description:
      'Of endorsementCount, how many were attributed to a client user',
  })
  endorsedByClientCount: number;

  @ApiProperty({
    description:
      'Of endorsementCount, how many were attributed to an admin user (or had no correlated actor)',
  })
  endorsedByAdminCount: number;

  @ApiProperty()
  lastEndorsedAt: string;
}

export class CandidateEndorsementsResponseDto {
  @ApiProperty({ type: [CandidateEndorsementRowDto] })
  data: CandidateEndorsementRowDto[];

  @ApiProperty({
    required: false,
    description: 'Omitted when export=true',
  })
  meta?: {
    total: number;
    totalPages: number;
    page: number;
    perPage: number;
  };
}
