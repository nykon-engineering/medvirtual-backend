import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { CreateTicketDto } from './dto/create-ticket.dto';
import { Priority, TicketStatus } from '@prisma/client';
import { ticketTypeDictionary } from '../common/dictionaries/ticket-type';
import { reassignTicketDto } from './dto/reassign-ticket.dto';

@Injectable()
export class TicketService {

  constructor(
    private readonly prisma: PrismaService
  ){}

  private async findOne(id: string): Promise<any> {

    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        organization: true,
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            job_title: true,
            role: true,
            status: true,
            email: true,
          }
        },
      },
    })

    return ticket;
  }


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
        },
        include: {
          organization: true,
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              job_title: true,
              role: true,
              status: true,
              email: true,
            }
          },
        },
      })
      if(!tickets) throw new BadRequestException('Failed to fetch tickets')
      return tickets;
    }catch(error){
      throw new BadRequestException('Error fetching tickets')
    }
  }

  async reassing(id: string, data: reassignTicketDto): Promise<Object> {
    try{

      const user = await this.prisma.uSER.findUnique({
        where: { id: data.assign_user_id }
      })
      if (!user) throw new BadRequestException('User to assign not found')

      const ticketUpdated = await this.prisma.ticket.update({
        where: { id },
        data: {
          user: { connect: { id: data.assign_user_id } }
        }
      })
      if(!ticketUpdated) throw new BadRequestException('Failed to reassign ticket')

      const ticket = await this.findOne(id)
      if(!ticket) throw new BadRequestException('Failed to fetch reassigned ticket')
      return ticket;

    }catch(error){
      throw new BadRequestException('Error reassigning ticket', error.message)
    }
  }
  
  async updateStatus(id: string, data: { status: string }): Promise<Object> {
    const currentStatus = await this.prisma.ticket.findUnique({
      where: { id },
      select: { status: true }
    })
    if(!currentStatus) throw new BadRequestException('Ticket not found')
    if(currentStatus.status === data.status) throw new BadRequestException(`Ticket is already in status: ${data.status}`)

    if(currentStatus.status === 'closed' && data.status=== 'resolved') throw new BadRequestException('Cannot change status from CLOSED to RESOLVED')

    try{
      const ticketUpdated = await this.prisma.ticket.update({
        where: { id },
        data: {
          status: data.status as TicketStatus
        }
      })
      if(!ticketUpdated) throw new BadRequestException('Failed to update ticket status')

      const ticket = await this.findOne(id)
      if(!ticket) throw new BadRequestException('Failed to fetch reassigned ticket')
      return ticket;
    }catch(error){
      throw new BadRequestException('Error updating ticket status', error.message)
    }
  }
 
  remove(id: number) {
    return `This action removes a #${id} ticket`;
  }
}
