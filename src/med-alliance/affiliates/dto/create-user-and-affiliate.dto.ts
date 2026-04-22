import {
  IsNotEmpty,
  IsString,
} from 'class-validator';

export class CreateUserAndAffiliateProfileDto {

  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  first_name: string;

  @IsString()
  @IsNotEmpty()
  last_name: string;

  @IsString()
  @IsNotEmpty()
  role: string;
}
