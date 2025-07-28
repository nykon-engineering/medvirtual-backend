import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString } from "class-validator";

export class AuthInviteUserDto {
    @ApiProperty({ required: true, description: 'User email' })
    @IsEmail()
    email: string;
  
    @ApiProperty({ required: false, description: 'User role' })
    @IsString()
    role: string;
  
    @ApiProperty({ required: false, description: 'User company name' })
    @IsString()
    companyName: string;

    @ApiProperty({ required: true, description: 'Organization ID' })
    @IsString()
    organizationId: string;
}