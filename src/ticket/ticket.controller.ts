import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  UseGuards,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { TicketService } from './ticket.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { reassignTicketDto } from './dto/reassign-ticket.dto';
import { updateStatusTicketDto } from './dto/update-status-ticket.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { USER } from '@prisma/client';
import { CreateTicketNoteDto } from './dto/create-ticket-note.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { ListTicketAuditLogsDto } from './dto/list-ticket-audit-logs.dto';
import { DeleteTicketDto } from './dto/delete-ticket.dto';
import { RestoreTicketDto } from './dto/restore-ticket.dto';
import { TicketDeletedStatus } from './ticket.service';

@ApiTags('tickets')
@ApiBearerAuth()
@Controller('tickets')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Post()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Create a new ticket' })
  @ApiBody({ type: CreateTicketDto })
  @ApiResponse({ status: 200, description: 'Ticket created successfully.' })
  @ApiResponse({ status: 400, description: 'Failed to create ticket.' })
  @ApiResponse({ status: 400, description: 'Error creating ticket.' })
  async create(
    @Body() createTicketDto: CreateTicketDto,
    @CurrentUser() user: USER,
  ): Promise<object> {
    const result = await this.ticketService.create(createTicketDto, user);
    return {
      status: 200,
      message: 'Ticket created successfully',
      data: result,
    };
  }

  @Post(':ticketId/notes')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Create a note for a ticket' })
  @ApiParam({ name: 'ticketId', type: String })
  @ApiBody({ type: CreateTicketNoteDto })
  @ApiResponse({ status: 200, description: 'Note created' })
  async addNote(
    @Param('ticketId') ticketId: string,
    @Body() dto: CreateTicketNoteDto,
    @CurrentUser() user: USER,
  ) {
    const result = await this.ticketService.addNote(ticketId, dto, user);
    return {
      status: 200,
      message: 'Note created',
      data: result,
    };
  }

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Get all tickets' })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Filter by ticket type',
  })
  @ApiQuery({
    name: 'priority',
    required: false,
    description: 'Filter by ticket priority',
  })
  @ApiQuery({
    name: 'assign_user_id',
    required: false,
    description: 'Filter by assigned user ID',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by client or subject',
  })
  @ApiQuery({
    name: 'deleted_status',
    required: false,
    enum: ['active', 'deleted'],
    description:
      'Which side of the soft-delete boundary to list. Defaults to active. Honored only for system_super_admin; ignored for every other role.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of tickets retrieved successfully.',
  })
  @ApiResponse({ status: 400, description: 'Failed to fetch tickets' })
  @ApiResponse({ status: 400, description: 'Error fetching tickets' })
  async findAll(
    @Query('type') type: string,
    @Query('priority') priority: string,
    @Query('assign_user_id') assign_user_id: string,
    @Query('search') search: string,
    @CurrentUser() user: USER,
    @Query('deleted_status') deleted_status?: string,
  ): Promise<object> {
    const result = await this.ticketService.findAll(
      user,
      type,
      priority,
      assign_user_id,
      search,
      deleted_status === 'deleted'
        ? 'deleted'
        : ('active' as TicketDeletedStatus),
    );
    return {
      status: 200,
      message: 'List of tickets retrieved successfully',
      data: result,
    };
  }

  // Must stay above @Get(':id') — otherwise 'audit-logs' is captured as an :id.
  @Get('audit-logs')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  @ApiOperation({
    summary: 'List ticket audit log entries',
    description:
      'Paginated, filterable view of the append-only ticket lifecycle audit trail.',
  })
  @ApiResponse({
    status: 200,
    description: 'Audit logs retrieved successfully',
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async listAuditLogs(@Query() query: ListTicketAuditLogsDto) {
    const result = await this.ticketService.listAuditLogs(query);
    return {
      status: 200,
      message: 'Audit logs retrieved successfully',
      ...result,
    };
  }

  @Get(':ticketId/notes')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'List all notes for a specific ticket' })
  @ApiParam({ name: 'ticketId', type: String })
  @ApiResponse({ status: 200, description: 'Notes retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listNotes(
    @Param('ticketId') ticketId: string,
    @CurrentUser() user: USER,
  ) {
    const notes = await this.ticketService.listNotes(ticketId, user);
    return {
      status: 200,
      message: 'Notes retrieved',
      data: notes,
    };
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(
    'system_super_admin',
    'system_admin',
    'organization_super_admin',
    'organization_admin',
  )
  @ApiOperation({ summary: 'Get a ticket by ID' })
  @ApiParam({ name: 'id', description: 'Ticket ID', required: true })
  @ApiResponse({ status: 200, description: 'Ticket retrieved successfully.' })
  @ApiResponse({ status: 400, description: 'Ticket not found.' })
  @ApiResponse({ status: 403, description: 'Access denied.' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: USER,
  ): Promise<object> {
    const result = await this.ticketService.findOne(id, user);
    return {
      status: 200,
      message: 'Ticket retrieved successfully',
      data: result,
    };
  }

  @Post('reassign/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  @ApiOperation({ summary: 'Reassign a ticket to another user' })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID of the ticket to reassign',
    type: String,
  })
  @ApiBody({ type: reassignTicketDto })
  @ApiResponse({ status: 200, description: 'Ticket reassigned successfully.' })
  @ApiResponse({ status: 400, description: 'User to assign not found' })
  @ApiResponse({ status: 400, description: 'Failed to reassign ticket' })
  @ApiResponse({
    status: 400,
    description: 'Failed to fetch reassigned ticket',
  })
  @ApiResponse({ status: 400, description: 'Error reassigning ticket.' })
  async reassing(
    @Param('id') id: string,
    @Body() data: reassignTicketDto,
    @CurrentUser() user: USER,
  ) {
    const result = await this.ticketService.reassing(id, data, user);
    return {
      status: 200,
      message: 'Ticket reassigned successfully',
      data: result,
    };
  }

  @Post(':id/restore')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  @ApiOperation({
    summary: 'Restore a soft-deleted ticket',
    description:
      'Reverses a soft delete, reviving only the bonuses and notes recorded by the matching delete event.',
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID of the ticket to restore',
    type: String,
  })
  @ApiBody({ type: RestoreTicketDto, required: false })
  @ApiResponse({ status: 200, description: 'Ticket restored successfully.' })
  @ApiResponse({
    status: 400,
    description: 'Ticket not found or not deleted / insufficient permissions.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async restore(
    @Param('id') id: string,
    @CurrentUser() user: USER,
    @Body() body?: RestoreTicketDto,
  ) {
    const result = await this.ticketService.restore(id, user, body?.reason);
    return {
      status: 200,
      message: 'Ticket restored successfully',
      data: result,
    };
  }

  @Get(':id/audit')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  @ApiOperation({
    summary: 'Get the audit timeline for a ticket',
    description:
      'Returns every audit entry for the ticket, oldest first. Works for soft-deleted tickets.',
  })
  @ApiParam({ name: 'id', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Audit log retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Ticket not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getTicketAuditLog(@Param('id') id: string) {
    const data = await this.ticketService.getTicketAuditLog(id);
    return {
      status: 200,
      message: 'Audit log retrieved successfully',
      data,
    };
  }

  @Post('update-status/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  @ApiOperation({ summary: 'update a ticket to another status' })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID of the ticket to reassign',
    type: String,
  })
  @ApiBody({ type: updateStatusTicketDto })
  @ApiResponse({ status: 200, description: 'Ticket reassigned successfully.' })
  @ApiResponse({ status: 400, description: 'User to assign not found' })
  @ApiResponse({ status: 400, description: 'Failed to reassign ticket' })
  @ApiResponse({
    status: 400,
    description: 'Failed to fetch reassigned ticket',
  })
  @ApiResponse({ status: 400, description: 'Error reassigning ticket.' })
  async updateStatus(
    @Param('id') id: string,
    @Body() data: updateStatusTicketDto,
    @CurrentUser() user: USER,
  ) {
    const result = await this.ticketService.updateStatus(id, data, user);
    return {
      status: 200,
      message: 'Ticket reassigned successfully',
      data: result,
    };
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  @ApiOperation({
    summary: 'Delete a ticket',
    description:
      'Soft-deletes a ticket by ID along with its notes and any bonuses it created. The ticket can be brought back with POST /tickets/:id/restore, and the deletion is recorded in the audit log. Accessible only by system_super_admin and system_admin roles.',
  })
  @ApiParam({ name: 'id', description: 'Ticket ID', required: true })
  @ApiBody({ type: DeleteTicketDto, required: false })
  @ApiResponse({ status: 200, description: 'Ticket deleted successfully.' })
  @ApiResponse({ status: 400, description: 'Ticket not found.' })
  @ApiResponse({
    status: 400,
    description: 'Insufficient permissions to delete tickets.',
  })
  @ApiResponse({ status: 400, description: 'Error deleting ticket.' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: USER,
    @Body() body?: DeleteTicketDto,
  ) {
    const result = await this.ticketService.delete(id, user, body?.reason);
    return {
      status: 200,
      message: 'Ticket deleted successfully',
      data: result,
    };
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(
    'system_super_admin',
    'system_admin',
    'organization_super_admin',
    'organization_admin',
  )
  @ApiOperation({ summary: 'Edit a ticket (title, description, priority)' })
  @ApiParam({ name: 'id', description: 'Ticket ID', required: true })
  @ApiBody({ type: UpdateTicketDto })
  @ApiResponse({ status: 200, description: 'Ticket updated successfully.' })
  @ApiResponse({
    status: 400,
    description: 'Ticket not found or invalid input.',
  })
  @ApiResponse({ status: 403, description: 'Access denied.' })
  async patch(
    @Param('id') id: string,
    @Body() body: UpdateTicketDto,
    @CurrentUser() user: USER,
  ) {
    const result = await this.ticketService.update(id, body, user);
    return {
      status: 200,
      message: 'Ticket updated successfully',
      data: result,
    };
  }
}
