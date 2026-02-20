import { Controller, Get, HttpCode, Query, UseGuards } from '@nestjs/common';
import { PanelService } from './panel.service';

import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';



@ApiTags('Panel')
@Controller('panel')
export class PanelController {

    constructor( 
        private readonly panelService: PanelService
    ){}

    @Get()
    @UseGuards(AuthGuard, RolesGuard)
    @Roles('system_super_admin', 'system_admin')
    @HttpCode(200)
    @ApiOperation({ summary: 'Get data to populate Dashboard' })
    async getPanelData(
        @Query('dateFrom') dateFrom?: string,
        @Query('dateTo') dateTo?: string
    ): Promise<any> {
        return await this.panelService.getPanelData(dateFrom, dateTo);

    }
}
