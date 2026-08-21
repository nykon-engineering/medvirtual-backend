import { ApiProperty } from '@nestjs/swagger';

export class ClientSelectedCandidateRowDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  candidateId: string;

  @ApiProperty()
  candidateName: string;

  @ApiProperty()
  hireRequestId: string;

  @ApiProperty()
  hireRequestTitle: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  organizationName: string;

  @ApiProperty()
  selectedAt: string;

  @ApiProperty({ nullable: true })
  selectedByUserId: string | null;

  @ApiProperty({ nullable: true })
  selectedByName: string | null;

  @ApiProperty({ nullable: true })
  selectedByRole: string | null;
}

export class ClientSelectedCandidatesResponseDto {
  @ApiProperty({ type: [ClientSelectedCandidateRowDto] })
  data: ClientSelectedCandidateRowDto[];

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
