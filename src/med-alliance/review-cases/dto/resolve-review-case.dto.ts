import { IsIn, IsOptional, IsString } from 'class-validator';

export class ResolveReviewCaseDto {
  @IsString()
  resolution: string;

  /**
   * For multiple_hubspot_matches: admin provides the correct HubSpot company ID
   * so the org can be synced and the pipeline can continue.
   */
  @IsOptional()
  @IsString()
  hubspot_company_id?: string;

  /**
   * For reconciliation_invoice_changed:
   * - void_and_recreate: void the existing commission and allow re-detection on next sync
   * - keep_existing: close the case, commission remains as-is
   */
  @IsOptional()
  @IsIn(['void_and_recreate', 'keep_existing'])
  action?: 'void_and_recreate' | 'keep_existing';
}
