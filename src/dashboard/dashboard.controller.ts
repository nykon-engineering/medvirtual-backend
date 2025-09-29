import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { USER } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

@Controller('dashboard')
export class DashboardController {

    constructor(
        private readonly dashboard: DashboardService
    ){}

    @Get()
    @UseGuards(AuthGuard)
    @ApiOperation({ description: 'Get dashboard data with optional pagination for hire requests' })
    @ApiQuery({ name: 'page', required: false, description: 'Page number for hire requests pagination' })
    @ApiQuery({ name: 'perPage', required: false, description: 'Number of hire requests per page' })
    @ApiResponse({ status: 200, description: 'Dashboard data retrieved successfully' })
    async getDashboardData(
        @CurrentUser() user: USER,
        @Query('page') page?: string,
        @Query('perPage') perPage?: string
    ): Promise<any> {
        const pageNumber = page ? parseInt(page, 10) : 1;
        const perPageNumber = perPage ? parseInt(perPage, 10) : 10;
        
        const result = await this.dashboard.getDashboardData(user, pageNumber, perPageNumber);
        
        return {
            status: 200,
            message: 'Dashboard data retrieved successfully',
            data: result
        }
    }
}
