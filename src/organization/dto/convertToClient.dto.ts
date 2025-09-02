import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsDateString, IsOptional } from "class-validator";

export class ConvertToClientDto {
  @ApiProperty({ required: true, description: 'URL to the signed document' })
  @IsString()
  signed_document_url: string;

  @ApiProperty({ required: false, description: 'Date when the document was signed' })
  @IsOptional()
  @IsDateString()
  signed_document_date?: string;
}

