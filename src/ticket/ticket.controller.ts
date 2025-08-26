import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

import { TicketService } from './ticket.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Priority } from '@prisma/client';


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
      data: result
    }
  }

  

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ticketService.remove(+id);
  }
}
