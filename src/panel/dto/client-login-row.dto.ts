import { ApiProperty } from '@nestjs/swagger';

export class ClientLoginRowDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userName: string;

  @ApiProperty()
  organizationName: string;

  @ApiProperty()
  loggedInAt: string;
}

export class ClientLoginsResponseDto {
  @ApiProperty({ type: [ClientLoginRowDto] })
  data: ClientLoginRowDto[];

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
