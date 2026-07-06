import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { EmailTemplatesService } from './email-templates.service';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';
import { PreviewEmailTemplateDto } from './dto/preview-email-template.dto';
import { TestSendEmailTemplateDto } from './dto/test-send-email-template.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('email-templates')
@ApiBearerAuth()
@Controller('email-templates')
export class EmailTemplatesController {
  constructor(private readonly service: EmailTemplatesService) {}

  // ── List ──────────────────────────────────────────────────────────────────

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_admin', 'system_super_admin')
  @ApiOperation({ summary: 'List all email templates with optional filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'businessUnit',
    required: false,
    type: String,
    description: 'Slug or "global" for null',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    type: String,
    description: 'Platform module, e.g. "talent", "alliance", "administration"',
  })
  @ApiQuery({
    name: 'functionality',
    required: false,
    type: String,
    description: 'Exact functionality label to filter by',
  })
  @ApiResponse({ status: 200, description: 'Templates retrieved successfully' })
  findAll(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('search') search?: string,
    @Query('businessUnit') businessUnit?: string,
    @Query('category') category?: string,
    @Query('functionality') functionality?: string,
  ) {
    return this.service.findAll(
      page ? Number(page) : 1,
      perPage ? Number(perPage) : 25,
      search ?? '',
      businessUnit,
      category,
      functionality,
    );
  }

  // ── Functionality options ────────────────────────────────────────────────
  // Registered before ':key' so this literal path isn't swallowed as a key param.

  @Get('functionality-options')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_admin', 'system_super_admin')
  @ApiOperation({
    summary: 'List distinct functionality values in use, for filter dropdowns',
  })
  @ApiResponse({
    status: 200,
    description: 'Distinct functionality values retrieved',
  })
  getFunctionalityOptions() {
    return this.service.getFunctionalityOptions();
  }

  // ── Detail ────────────────────────────────────────────────────────────────

  @Get(':key')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_admin', 'system_super_admin')
  @ApiOperation({ summary: 'Get a single email template by key' })
  @ApiParam({ name: 'key', description: 'Template key, e.g. "invite-signup"' })
  @ApiQuery({ name: 'businessUnit', required: false, type: String })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'Template not found' })
  findOne(
    @Param('key') key: string,
    @Query('businessUnit') businessUnit?: string,
  ) {
    return this.service.findOne(key, businessUnit);
  }

  // ── Update ────────────────────────────────────────────────────────────────

  @Put(':key')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_admin', 'system_super_admin')
  @ApiOperation({ summary: 'Update wording of an email template' })
  @ApiParam({ name: 'key', description: 'Template key' })
  @ApiQuery({ name: 'businessUnit', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Template updated and synced to peer',
  })
  @ApiResponse({ status: 400, description: 'Invalid placeholder in body' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  update(
    @Param('key') key: string,
    @Body() dto: UpdateEmailTemplateDto,
    @Request() req: { user: { id: string } },
    @Query('businessUnit') businessUnit?: string,
  ) {
    return this.service.update(key, dto, req.user.id, businessUnit);
  }

  // ── History ───────────────────────────────────────────────────────────────

  @Get(':key/history')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_admin', 'system_super_admin')
  @ApiOperation({
    summary: 'Get change history for a template (last 50 versions)',
  })
  @ApiParam({ name: 'key', description: 'Template key' })
  @ApiQuery({ name: 'businessUnit', required: false, type: String })
  @ApiResponse({ status: 200 })
  getHistory(
    @Param('key') key: string,
    @Query('businessUnit') businessUnit?: string,
  ) {
    return this.service.getHistory(key, businessUnit);
  }

  // ── Rollback ──────────────────────────────────────────────────────────────

  @Post(':key/rollback/:historyId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_admin', 'system_super_admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Roll back a template to a previous version' })
  @ApiParam({ name: 'key', description: 'Template key' })
  @ApiParam({ name: 'historyId', description: 'History entry ID to restore' })
  @ApiQuery({ name: 'businessUnit', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Template rolled back and synced to peer',
  })
  rollback(
    @Param('key') key: string,
    @Param('historyId') historyId: string,
    @Request() req: { user: { id: string } },
    @Query('businessUnit') businessUnit?: string,
  ) {
    return this.service.rollback(key, historyId, req.user.id, businessUnit);
  }

  // ── Preview ───────────────────────────────────────────────────────────────

  @Post(':key/preview')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_admin', 'system_super_admin')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Render a template to HTML with sample data for preview',
  })
  @ApiParam({ name: 'key', description: 'Template key' })
  @ApiQuery({ name: 'businessUnit', required: false, type: String })
  @ApiResponse({ status: 200, description: 'HTML preview generated' })
  preview(
    @Param('key') key: string,
    @Body() dto: PreviewEmailTemplateDto,
    @Query('businessUnit') businessUnit?: string,
  ) {
    return this.service.preview(key, dto, businessUnit);
  }

  // ── Test Send ─────────────────────────────────────────────────────────────

  @Post(':key/test-send')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_admin', 'system_super_admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send a test email to the logged-in user' })
  @ApiParam({ name: 'key', description: 'Template key' })
  @ApiQuery({ name: 'businessUnit', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Test email sent' })
  testSend(
    @Param('key') key: string,
    @Body() dto: TestSendEmailTemplateDto,
    @Request() req: { user: { id: string; email: string } },
    @Query('businessUnit') businessUnit?: string,
  ) {
    return this.service.testSend(
      key,
      dto,
      req.user.id,
      req.user.email,
      businessUnit,
    );
  }

  // ── Sync receiver (internal — peer environment only) ──────────────────────

  @Post(':key/sync')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Receive a template sync from the peer environment (internal)',
  })
  @ApiParam({ name: 'key', description: 'Template key' })
  @ApiResponse({ status: 200, description: 'Sync applied' })
  @ApiResponse({ status: 401, description: 'Invalid sync secret' })
  async receiveSync(
    @Param('key') key: string,
    @Body()
    body: {
      subject: string;
      headline?: string;
      body: string;
      button_label?: string;
      button_url?: string;
      category?: string;
      functionality?: string;
    },
    @Headers('x-sync-secret') secret: string,
    @Headers('x-sync-origin') origin: string,
  ) {
    if (!secret || secret !== process.env.INTER_ENV_SYNC_SECRET) {
      throw new UnauthorizedException('Invalid sync secret');
    }
    await this.service.receiveSyncFromPeer(key, body, origin ?? 'unknown');
    return { status: 200, message: 'Sync applied' };
  }
}
