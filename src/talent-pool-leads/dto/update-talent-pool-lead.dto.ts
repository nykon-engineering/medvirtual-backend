import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn, IsUUID } from 'class-validator';

export class UpdateTalentPoolLeadDto {
  @ApiProperty({
    description: 'Status of the lead',
    example: 'contacted',
    enum: ['new', 'contacted', 'qualified', 'converted', 'rejected'],
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(['new', 'contacted', 'qualified', 'converted', 'rejected'], {
    message:
      'Status must be one of: new, contacted, qualified, converted, rejected',
  })
  status?: string;

  @ApiProperty({
    description: 'Notes about the lead',
    example: 'Called on 2024-01-16, interested in 5 VAs',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'ID of the user assigned to this lead',
    example: 'user-uuid',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  assigned_to_user_id?: string;
}
