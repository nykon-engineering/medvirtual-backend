import {
  Controller,
  Get,
  HttpCode,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { AuthGuard } from '../../auth/auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';
import { USER } from '@prisma/client';
import { ADMIN_ROLES, AFFILIATE_ROLES } from '../constants';
import { ListInvoicesDto } from './dto/list-invoices.dto';

@Controller('med-alliance')
@UseGuards(AuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  // ---------------------------------------------------------------------------
  // Affiliate routes
  // ---------------------------------------------------------------------------

  // GET /med-alliance/referred-companies/:id/invoices
  // Returns HubspotInvoiceSnapshot list for a referred company owned by the
  // current affiliate. Each item includes the computed is_candidate_input flag.
  @Get('referred-companies/:id/invoices')
  @HttpCode(200)
  @Roles(...AFFILIATE_ROLES)
  async getForAffiliate(
    @Param('id') organizationId: string,
    @Query() query: ListInvoicesDto,
    @CurrentUser() user: USER,
  ) {
    const result = await this.invoicesService.getForAffiliate(
      organizationId,
      user,
      query,
    );
    return {
      status: 200,
      message: 'Invoice snapshots retrieved successfully',
      ...result,
    };
  }

  // ---------------------------------------------------------------------------
  // Admin routes
  // ---------------------------------------------------------------------------

  // GET /med-alliance/admin/referred-companies/:id/invoices
  // Same payload as the affiliate route but without affiliate scoping.
  @Get('admin/referred-companies/:id/invoices')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async getForAdmin(
    @Param('id') organizationId: string,
    @Query() query: ListInvoicesDto,
  ) {
    const result = await this.invoicesService.getForAdmin(organizationId, query);
    return {
      status: 200,
      message: 'Invoice snapshots retrieved successfully',
      ...result,
    };
  }

  // GET /med-alliance/admin/invoices
  // Global list of all snapshots across all organizations with full filters.
  @Get('admin/invoices')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async listAllForAdmin(@Query() query: ListInvoicesDto) {
    const result = await this.invoicesService.listAllForAdmin(query);
    return {
      status: 200,
      message: 'Invoice snapshots retrieved successfully',
      ...result,
    };
  }
}
