import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum CommissionsAction {
  void = 'void',
  keep = 'keep',
}

export class BlockEligibilityDto {
  @ApiProperty({
    example:
      'Referred company is an existing active MedVirtual client — commission not warranted.',
  })
  @IsNotEmpty()
  @IsString()
  reason: string;

  @ApiProperty({
    enum: CommissionsAction,
    description:
      "Whether to void the company's detected/pending_admin_confirmation commissions when blocking, or leave them untouched.",
    example: CommissionsAction.void,
  })
  @IsEnum(CommissionsAction)
  commissions_action: CommissionsAction;
}
