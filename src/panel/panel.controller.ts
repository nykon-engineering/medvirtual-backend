import { Controller, Get, HttpCode, Query, UseGuards } from '@nestjs/common';
import { PanelService } from './panel.service';

import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';



@ApiTags('Panel')
@ApiBearerAuth()
@Controller('panel')
export class PanelController {

    constructor(
        private readonly panelService: PanelService
    ){}

    @Get()
    @UseGuards(AuthGuard, RolesGuard)
    @Roles('system_super_admin', 'system_admin')
    @HttpCode(200)
    @ApiOperation({ summary: 'Get aggregated data to populate the internal admin panel dashboard' })
    @ApiQuery({ name: 'dateFrom', required: false, description: 'Start date filter (ISO date string)', example: '2024-01-01' })
    @ApiQuery({ name: 'dateTo', required: false, description: 'End date filter (ISO date string)', example: '2024-12-31' })
    @ApiResponse({ status: 200, description: 'Panel data retrieved successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Access denied: insufficient permissions' })
    async getPanelData(
        @Query('dateFrom') dateFrom?: string,
        @Query('dateTo') dateTo?: string
    ): Promise<any> {
        return await this.panelService.getPanelData(dateFrom, dateTo);

    }
}
