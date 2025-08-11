import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { USER } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';

@Controller('dashboard')
export class DashboardController {

    constructor(
        private readonly dashboard: DashboardService
    ){}

    @Get()
    @UseGuards(AuthGuard)
    async getDashboardData(@CurrentUser() user: USER): Promise<any> {
        const result = await this.dashboard.getDashboardData(user);
        
        return {
            status: 200,
            message: 'Dashboard data retrieved successfully',
            data: result
        }
    }
}
