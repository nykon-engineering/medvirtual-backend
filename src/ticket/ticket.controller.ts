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
  ): Promise<object> {
    const result = await this.ticketService.findAll(
      user,
      type,
      priority,
      assign_user_id,
      search,
    );
    return {
      status: 200,
      message: 'List of tickets retrieved successfully',
      data: result,
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
  @Roles('system_super_admin', 'system_admin', 'organization_super_admin', 'organization_admin')
  @ApiOperation({ summary: 'Get a ticket by ID' })
  @ApiParam({ name: 'id', description: 'Ticket ID', required: true })
  @ApiResponse({ status: 200, description: 'Ticket retrieved successfully.' })
  @ApiResponse({ status: 400, description: 'Ticket not found.' })
  @ApiResponse({ status: 403, description: 'Access denied.' })
  async findOne(@Param('id') id: string, @CurrentUser() user: USER): Promise<object> {
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
  async reassing(@Param('id') id: string, @Body() data: reassignTicketDto) {
    const result = await this.ticketService.reassing(id, data);
    return {
      status: 200,
      message: 'Ticket reassigned successfully',
      data: result,
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
  ) {
    const result = await this.ticketService.updateStatus(id, data);
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
      'Delete a ticket by ID. Accessible only by system_super_admin and system_admin roles.',
  })
  @ApiParam({ name: 'id', description: 'Ticket ID', required: true })
  @ApiResponse({ status: 200, description: 'Ticket deleted successfully.' })
  @ApiResponse({ status: 400, description: 'Ticket not found.' })
  @ApiResponse({
    status: 400,
    description: 'Insufficient permissions to delete tickets.',
  })
  @ApiResponse({ status: 400, description: 'Error deleting ticket.' })
  async delete(@Param('id') id: string, @CurrentUser() user: USER) {
    const result = await this.ticketService.delete(id, user);
    return {
      status: 200,
      message: 'Ticket deleted successfully',
      data: result,
    };
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin', 'organization_super_admin', 'organization_admin')
  @ApiOperation({ summary: 'Edit a ticket (title, description, priority)' })
  @ApiParam({ name: 'id', description: 'Ticket ID', required: true })
  @ApiBody({ type: UpdateTicketDto })
  @ApiResponse({ status: 200, description: 'Ticket updated successfully.' })
  @ApiResponse({ status: 400, description: 'Ticket not found or invalid input.' })
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
