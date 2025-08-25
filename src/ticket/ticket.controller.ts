import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { TicketService } from './ticket.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';


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
  @ApiResponse({ status: 200, description: 'List of tickets retrieved successfully.'})
  @ApiResponse({ status: 400, description: 'Failed to fetch tickets'})
  @ApiResponse({ status: 400, description: 'Error fetching tickets'})
  async findAll(): Promise<Object> {
    const result = await this.ticketService.findAll();
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
