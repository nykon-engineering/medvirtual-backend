import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import { PositionRateConfigService } from './position-rate-config.service';
import { UpdatePositionRateConfigDto } from './dto/update-position-rate-config.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('position-rate-config')
@UseGuards(AuthGuard, RolesGuard)
@Roles('system_admin', 'system_super_admin')
export class PositionRateConfigController {
  constructor(private readonly service: PositionRateConfigService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Put(':position')
  upsert(
    @Param('position') position: string,
    @Body() dto: UpdatePositionRateConfigDto,
  ) {
    return this.service.upsert(position, dto);
  }
}
