import { Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { USER } from '@prisma/client';
import { AuthGuard } from '../../auth/auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';
import { ADMIN_ROLES } from '../constants';
import { BillComPayoutService } from './bill-com-payout.service';

@ApiTags('med-alliance')
@ApiBearerAuth()
@Controller('med-alliance')
@UseGuards(AuthGuard, RolesGuard)
export class BillComAdminController {
  constructor(private readonly billComPayoutService: BillComPayoutService) {}

  @Post('admin/payout-requests/:id/initiate-payment')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  @ApiOperation({
    summary: 'Initiate a Bill.com payment for an approved payout request',
  })
  @ApiParam({ name: 'id', description: 'Payout request ID' })
  @ApiResponse({
    status: 200,
    description: 'Payment submitted to Bill.com, payout moved to processing',
  })
  @ApiResponse({
    status: 400,
    description:
      'Payout not in approved status or missing Bill.com account number',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 502, description: 'Bill.com API error' })
  async initiatePayment(@Param('id') id: string, @CurrentUser() admin: USER) {
    return this.billComPayoutService.initiatePayment(id, admin);
  }

  @Post('admin/payout-requests/:id/retry-payment')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  @ApiOperation({
    summary: 'Reset a failed payout request back to approved for retry',
  })
  @ApiParam({ name: 'id', description: 'Payout request ID' })
  @ApiResponse({ status: 200, description: 'Payout reset to approved status' })
  @ApiResponse({ status: 400, description: 'Payout is not in failed status' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async retryPayment(@Param('id') id: string, @CurrentUser() admin: USER) {
    return this.billComPayoutService.retryPayment(id, admin);
  }
}
