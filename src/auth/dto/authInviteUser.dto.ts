import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString } from "class-validator";

export class AuthInviteUserDto {
    
    @ApiProperty({ required: true, description: 'User first name' })
    @IsString()
    firstName: string;
  
    @ApiProperty({ required: true, description: 'User last name' })
    @IsString()
    lastName: string;

    @ApiProperty({ required: true, description: 'User email' })
    @IsEmail()
    email: string;
  
    @ApiProperty({ required: false, description: 'User role' })
    @IsString()
    role: string;
  
    @ApiProperty({ required: false, description: 'User job title' })
    @IsString()
    jobTitle: string;
  
    @ApiProperty({ required: false, description: 'User company name' })
    @IsString()
    companyName: string;
}