import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class BillComLoginDto {
  @ApiProperty({
    required: true,
    description: "Admin's own Bill.com account email",
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    required: true,
    description: "Admin's own Bill.com account password",
  })
  @IsString()
  @MinLength(1)
  password: string;
}
