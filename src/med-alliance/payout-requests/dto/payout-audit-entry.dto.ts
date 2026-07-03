import { ApiProperty } from '@nestjs/swagger';

/**
 * Shape of a single entry in the payout-request audit timeline.
 * Exposes both the legacy `old_status`/`new_status` keys and the
 * `from_status`/`to_status` aliases the frontend Activity timeline renders
 * as a from → to status pill pair.
 */
export class PayoutAuditEntryDto {
  @ApiProperty({ description: 'Audit log entry UUID', format: 'uuid' })
  id: string;

  @ApiProperty({
    description:
      'Descriptive action for the transition (title-cased by the frontend), e.g. request_submitted, request_approved, payment_completed, request_cancelled',
    example: 'request_approved',
  })
  action: string;

  @ApiProperty({
    description: 'Full name of the actor who performed the action, or "System"',
    example: 'Admin User',
  })
  actor: string;

  @ApiProperty({
    description: 'When the action occurred',
    type: String,
    format: 'date-time',
  })
  timestamp: Date;

  @ApiProperty({
    description: 'Optional reason / note attached to the transition',
    required: false,
    nullable: true,
    example: 'Insufficient documentation',
  })
  notes?: string;

  @ApiProperty({
    description:
      'Status the payout request transitioned from (null for the initial submission)',
    required: false,
    nullable: true,
    example: 'requested',
  })
  from_status: string | null;

  @ApiProperty({
    description: 'Status the payout request transitioned to',
    required: false,
    nullable: true,
    example: 'approved',
  })
  to_status: string | null;

  @ApiProperty({
    description:
      'Deprecated alias of from_status — kept for backward compatibility',
    required: false,
    nullable: true,
    deprecated: true,
  })
  old_status: string | null;

  @ApiProperty({
    description:
      'Deprecated alias of to_status — kept for backward compatibility',
    required: false,
    nullable: true,
    deprecated: true,
  })
  new_status: string | null;
}
