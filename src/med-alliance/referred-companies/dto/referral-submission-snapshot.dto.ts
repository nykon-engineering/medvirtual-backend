import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReferralSubmissionSnapshotDto {
  @ApiProperty({
    description: 'Company name as submitted',
    example: 'Acme Healthcare',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Industry sector as submitted',
    example: 'Healthcare',
  })
  industry: string | null;

  @ApiPropertyOptional({
    description: 'Company website URL as submitted',
    example: 'https://acme.com',
  })
  website_url: string | null;

  @ApiPropertyOptional({
    description: 'Company location as submitted',
    example: 'New York, NY',
  })
  location: string | null;

  @ApiPropertyOptional({
    description: 'Company phone number as submitted',
    example: '+1-555-123-4567',
  })
  phone: string | null;

  @ApiProperty({ description: 'Primary contact first name', example: 'John' })
  contact_first_name: string;

  @ApiProperty({ description: 'Primary contact last name', example: 'Doe' })
  contact_last_name: string;

  @ApiProperty({
    description: 'Primary contact email address',
    example: 'john.doe@acme.com',
  })
  contact_email: string;

  @ApiPropertyOptional({
    description:
      'UUID of the user this referral was directed to at submission time',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  refer_to_user_id: string | null;

  @ApiProperty({
    description: 'ISO timestamp of when the referral was submitted',
    example: '2026-07-10T12:00:00.000Z',
  })
  submitted_at: string;
}
