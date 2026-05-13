import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTicketNoteDto {
  @ApiProperty({ description: 'Note content', required: true, type: String })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content: string;

  @ApiProperty({
    description: 'Whether the note is internal',
    required: false,
    type: Boolean,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  is_internal?: boolean = false;
}
