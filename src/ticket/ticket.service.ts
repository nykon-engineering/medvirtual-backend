import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { connect } from 'http2';
import { title } from 'process';
import { Priority } from '@prisma/client';

@Injectable()
export class TicketService {

  constructor(
    private readonly prisma: PrismaService
  ){

  }

  async create(createTicketDto: CreateTicketDto): Promise<Object> {
    try{
      const ticket = await this.prisma.ticket.create({
        data: {
          organization: { connect: { id: createTicketDto.client_id } },
          type: createTicketDto.type,
          title: createTicketDto.title,
          description: createTicketDto.description,
          priority: createTicketDto.priority as Priority,
          user: {connect: { id: createTicketDto.assign_id } },
        }
      })
      if(!ticket) throw new BadRequestException('Failed to create ticket')
      return ticket;
    }catch(error){
      throw new BadRequestException('Error creating ticket')
    }

  }

  async findAll(): Promise<Object[]> {
    try{
      const tickets = await this.prisma.ticket.findMany({})
      if(!tickets) throw new BadRequestException('Failed to fetch tickets')
      return tickets;
    }catch(error){
      throw new BadRequestException('Error fetching tickets')
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} ticket`;
  }

  update(id: number, updateTicketDto: UpdateTicketDto) {
    return `This action updates a #${id} ticket`;
  }

  remove(id: number) {
    return `This action removes a #${id} ticket`;
  }
}
