import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Put,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { BusinessUnitsService } from './business-units.service';
import { CreateBusinessUnitDto } from './dto/create-business-unit.dto';
import { UpdateBusinessUnitDto } from './dto/update-business-unit.dto';
import { UpdateBrandingDto } from './dto/update-branding.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('business-units')
@ApiBearerAuth()
@Controller('business-units')
@UseGuards(AuthGuard, RolesGuard)
@Roles('system_super_admin')
export class BusinessUnitsController {
  constructor(private readonly service: BusinessUnitsService) {}

  // ── BU CRUD ───────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all business units with their branding' })
  @ApiResponse({ status: 200 })
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new business unit (auto-creates default branding)',
  })
  @ApiResponse({ status: 201, description: 'Business unit created' })
  @ApiResponse({ status: 400, description: 'Slug already in use' })
  create(
    @Body() dto: CreateBusinessUnitDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.service.create(dto, req.user.id);
  }

  @Put(':slug')
  @ApiOperation({ summary: 'Update name or active status of a business unit' })
  @ApiParam({ name: 'slug', description: 'Business unit slug' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  update(@Param('slug') slug: string, @Body() dto: UpdateBusinessUnitDto) {
    return this.service.update(slug, dto);
  }

  @Delete(':slug')
  @ApiOperation({ summary: 'Deactivate a business unit (soft delete)' })
  @ApiParam({ name: 'slug', description: 'Business unit slug' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  deactivate(@Param('slug') slug: string) {
    return this.service.deactivate(slug);
  }

  // ── Branding ──────────────────────────────────────────────────────────────

  @Get(':slug/branding')
  @ApiOperation({ summary: 'Get branding for a business unit' })
  @ApiParam({ name: 'slug', description: 'Business unit slug' })
  @ApiResponse({ status: 200 })
  getBranding(@Param('slug') slug: string) {
    return this.service.getBranding(slug);
  }

  @Put(':slug/branding')
  @ApiOperation({
    summary: 'Update branding for a business unit (snapshots history)',
  })
  @ApiParam({ name: 'slug', description: 'Business unit slug' })
  @ApiResponse({ status: 200 })
  updateBranding(
    @Param('slug') slug: string,
    @Body() dto: UpdateBrandingDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.service.updateBranding(slug, dto, req.user.id);
  }

  @Get(':slug/branding/history')
  @ApiOperation({ summary: 'Get branding change history for a business unit' })
  @ApiParam({ name: 'slug', description: 'Business unit slug' })
  @ApiResponse({ status: 200 })
  getBrandingHistory(@Param('slug') slug: string) {
    return this.service.getBrandingHistory(slug);
  }

  // ── Sync receiver (internal — peer environment only) ──────────────────────

  @Post(':slug/branding/sync')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Receive a branding sync from the peer environment (internal)',
  })
  @ApiParam({ name: 'slug', description: 'Business unit slug' })
  @ApiResponse({ status: 200, description: 'Sync applied' })
  @ApiResponse({ status: 401, description: 'Invalid sync secret' })
  async receiveBrandingSync(
    @Param('slug') slug: string,
    @Body()
    body: {
      primary_color?: string;
      secondary_color?: string;
      logo_url?: string;
      company_name?: string;
      layout_preset?: string;
    },
    @Headers('x-sync-secret') secret: string,
    @Headers('x-sync-origin') origin: string,
  ) {
    if (!secret || secret !== process.env.INTER_ENV_SYNC_SECRET) {
      throw new UnauthorizedException('Invalid sync secret');
    }
    await this.service.receiveBrandingSyncFromPeer(
      slug,
      body,
      origin ?? 'unknown',
    );
    return { status: 200, message: 'Branding sync applied' };
  }
}
