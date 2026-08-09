import { Controller, Get, UseGuards, Query, Param } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { Role, USER } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Get dashboard data with hire request summary and pagination',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number for hire requests pagination',
  })
  @ApiQuery({
    name: 'perPage',
    required: false,
    description: 'Number of hire requests per page',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard data retrieved successfully',
  })
  async getDashboardData(
    @CurrentUser() user: USER,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ): Promise<any> {
    const pageNumber = page ? parseInt(page, 10) : 1;
    const perPageNumber = perPage ? parseInt(perPage, 10) : 10;

    const result = await this.dashboard.getDashboardData(
      user,
      pageNumber,
      perPageNumber,
    );

    return {
      status: 200,
      message: 'Dashboard data retrieved successfully',
      data: result,
    };
  }

  @Get('/:interviewId')
  @UseGuards(AuthGuard)
  @Roles(Role.organization_admin, Role.organization_super_admin)
  @ApiOperation({
    summary:
      'Hide the interview alert for the current user so it does not appear again',
  })
  @ApiParam({
    name: 'interviewId',
    description: 'ID of the interview to hide alert for',
  })
  @ApiResponse({ status: 200, description: 'Alert hidden successfully' })
  @ApiResponse({ status: 400, description: 'Interview ID is required' })
  @ApiResponse({
    status: 400,
    description: 'Failed to close alert for the interview',
  })
  async closeAlert(@Param('interviewId') interviewId: string): Promise<any> {
    const result = await this.dashboard.closeAlert(interviewId);
    return {
      status: 200,
      data: result,
      message: `Alert hidden successfully`,
    };
  }
}
