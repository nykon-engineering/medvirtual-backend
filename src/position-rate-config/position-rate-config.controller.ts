import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PositionRateConfigService } from './position-rate-config.service';
import { UpdatePositionRateConfigDto } from './dto/update-position-rate-config.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('position-rate-config')
@ApiBearerAuth()
@Controller('position-rate-config')
@UseGuards(AuthGuard, RolesGuard)
@Roles('system_admin', 'system_super_admin')
export class PositionRateConfigController {
  constructor(private readonly service: PositionRateConfigService) {}

  @Get()
  @ApiOperation({
    summary:
      'List all VA position rate configurations with optional search and pagination',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'perPage',
    required: false,
    type: Number,
    description: 'Items per page (default: 10)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by position name',
  })
  @ApiResponse({
    status: 200,
    description: 'Position rate configs retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied: insufficient permissions',
  })
  findAll(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll(
      page ? Number(page) : 1,
      perPage ? Number(perPage) : 10,
      search ?? '',
    );
  }

  @Put(':position')
  @ApiOperation({
    summary:
      'Create or update the rate configuration for a specific VA position',
  })
  @ApiParam({
    name: 'position',
    description: 'VA position name',
    example: 'Medical Virtual Assistant',
  })
  @ApiBody({ type: UpdatePositionRateConfigDto })
  @ApiResponse({
    status: 200,
    description: 'Position rate config created or updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({
    status: 403,
    description: 'Access denied: insufficient permissions',
  })
  upsert(
    @Param('position') position: string,
    @Body() dto: UpdatePositionRateConfigDto,
  ) {
    return this.service.upsert(position, dto);
  }
}
