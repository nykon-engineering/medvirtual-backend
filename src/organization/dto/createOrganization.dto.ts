import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class CreateOrganizationDto {
  @ApiProperty({ required: true, description: 'Name of the organization' })
  @IsString()
  name: string;

  @ApiProperty({ required: true, description: 'Cellphone number for the organization' })
  @IsString()
  cellphone: string;
  
  @ApiProperty({ required: true, description: 'Email address of the organization' })
  @IsString()
  email: string;

  @ApiProperty({ required: true, description: 'Email of the organizations owner' })
  @IsString()
  super_admin_email: string;
}
