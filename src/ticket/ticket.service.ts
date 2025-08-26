import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { CreateTicketDto } from './dto/create-ticket.dto';
import { Priority } from '@prisma/client';
import { ticketTypeDictionary } from '../common/dictionaries/ticket-type';

@Injectable()
export class TicketService {

  constructor(
    private readonly prisma: PrismaService
  ){}

  async create(createTicketDto: CreateTicketDto): Promise<Object> {

    const typeBE = ticketTypeDictionary[createTicketDto.type] ?? null;
    try{
      const ticket = await this.prisma.ticket.create({
        data: {
          organization: { connect: { id: createTicketDto.client_id } },
          type: typeBE,
          title: createTicketDto.title,
          description: createTicketDto.description,
          priority: createTicketDto.priority as Priority,
          user: createTicketDto.assign_user_id ? { connect: { id: createTicketDto.assign_user_id } } : undefined,
        }
      })
      if(!ticket) throw new BadRequestException('Failed to create ticket')
      return ticket;
    }catch(error){
      throw new BadRequestException('Error creating ticket', error.message)
    }

  }

  async findAll(type?: string, priority?: string, assign_user_id?: string, search?: string): Promise<Object[]> {
    try{
      const tickets = await this.prisma.ticket.findMany({
        where:{
          type: type ? type : undefined,
          priority: priority ? priority as Priority : undefined,
          user: assign_user_id ? { is : { id: assign_user_id}} : undefined,
          OR: search ? [
            { organization: { name: { contains: search, mode: 'insensitive' } } },
            { title: { contains: search, mode: 'insensitive' } }
          ] : undefined
        }
      })
      if(!tickets) throw new BadRequestException('Failed to fetch tickets')
      return tickets;
    }catch(error){
      throw new BadRequestException('Error fetching tickets')
    }
  }

 
  remove(id: number) {
    return `This action removes a #${id} ticket`;
  }
}
