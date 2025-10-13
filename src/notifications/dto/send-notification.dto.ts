import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEmail, IsOptional, IsString } from 'class-validator';

export class SendNotificationDto {
  @ApiProperty({ description: 'Sender email (from)', example: 'MedVirtual <noreply@medvirtual.ai>' })
  @IsString()
  from: string;

  @ApiProperty({ description: 'Recipient emails', example: ['user@example.com'] })
  @IsArray()
  @IsEmail({}, { each: true })
  to: string[];

  @ApiProperty({ description: 'CC emails', required: false, example: ['manager@example.com'] })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  cc?: string[];

  @ApiProperty({ description: 'Email subject', example: 'Notification' })
  @IsString()
  subject: string;

  @ApiProperty({ description: 'HTML content', example: '<p>Hello</p>' })
  @IsString()
  html: string;
}


