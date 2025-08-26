import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';

import { TicketService } from './ticket.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { reassignTicketDto } from './dto/reassign-ticket.dto';
import { updateStatusTicketDto } from './dto/update-status-ticket.dto';


@Controller('ticket')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  @ApiOperation({ summary: 'Create a new ticket',})
  @ApiBody({ type: CreateTicketDto })
  @ApiResponse({ status: 200, description: 'Ticket created successfully.'})
  @ApiResponse({ status: 400, description: 'Failed to create ticket.'})
  @ApiResponse({ status: 400, description: 'Error creating ticket.'})
  async create(@Body() createTicketDto: CreateTicketDto): Promise <Object> {
    const result = await this.ticketService.create(createTicketDto);
    return {
      status: 200,
      message: 'Ticket created successfully',
      data: result
    }
  }

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  @ApiOperation({ summary: 'Get all tickets',})
  @ApiQuery({ name: 'type', required: false, description: 'Filter by ticket type' })
  @ApiQuery({ name: 'priority', required: false, description: 'Filter by ticket priority' })
  @ApiQuery({ name: 'assign_user_id', required: false, description: 'Filter by assigned user ID' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by client or subject' })
  @ApiResponse({ status: 200, description: 'List of tickets retrieved successfully.'})
  @ApiResponse({ status: 400, description: 'Failed to fetch tickets'})
  @ApiResponse({ status: 400, description: 'Error fetching tickets'})
  async findAll(
    @Query('type') type: string, 
    @Query('priority') priority: string,
    @Query('assign_user_id') assign_user_id: string,
    @Query('search') search: string
  ): Promise<Object> {
    const result = await this.ticketService.findAll(type, priority, assign_user_id, search);
    return {
      status: 200, 
      message: 'List of tickets retrieved successfully',
      data: result,
    };
  }

  @Post('reassign/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  @ApiOperation({ summary: 'Reassign a ticket to another user',})
  @ApiParam({ name: 'id', required: true, description: 'ID of the ticket to reassign', type: String })
  @ApiBody({ type: reassignTicketDto })
  @ApiResponse({ status: 200, description: 'Ticket reassigned successfully.'})
  @ApiResponse({ status: 400, description: 'User to assign not found'})
  @ApiResponse({ status: 400, description: 'Failed to reassign ticket'})
  @ApiResponse({ status: 400, description: 'Failed to fetch reassigned ticket'})
  @ApiResponse({ status: 400, description: 'Error reassigning ticket.'})
  async reassing(@Param('id') id: string, @Body() data: reassignTicketDto) {
    const result = await this.ticketService.reassing(id, data);
    return{
      status: 200,
      message: 'Ticket reassigned successfully',
      data: result
    }
  }

  @Post('update-status/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  @ApiOperation({ summary: 'update a ticket to another status',})
  @ApiParam({ name: 'id', required: true, description: 'ID of the ticket to reassign', type: String })
  @ApiBody({ type: updateStatusTicketDto })
  @ApiResponse({ status: 200, description: 'Ticket reassigned successfully.'})
  @ApiResponse({ status: 400, description: 'User to assign not found'})
  @ApiResponse({ status: 400, description: 'Failed to reassign ticket'})
  @ApiResponse({ status: 400, description: 'Failed to fetch reassigned ticket'})
  @ApiResponse({ status: 400, description: 'Error reassigning ticket.'})
  async updateStatus(@Param('id') id: string, @Body() data: updateStatusTicketDto) {
    const result = await this.ticketService.updateStatus(id, data);
    return{
      status: 200,
      message: 'Ticket reassigned successfully',
      data: result
    }
  }

  

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ticketService.remove(+id);
  }
}
