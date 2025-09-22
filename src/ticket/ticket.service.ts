import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { CreateTicketDto } from './dto/create-ticket.dto';
import { Priority, TicketStatus, USER } from '@prisma/client';
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
      select:{
        id: true,
        type: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        createdAt: true,
        organization: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            admin_id: true,
          }
        },
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
        candidate: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            name: true,
          }
        }
      }
    })

    return ticket;
  }


  async create(createTicketDto: CreateTicketDto, user: USER): Promise<Object> {
    const typeBE = ticketTypeDictionary[createTicketDto.type] ?? null;
    
    if (createTicketDto.type === 'Interview Request' && !createTicketDto.candidate_id) {
      throw new BadRequestException('Candidate ID is required for Interview Request tickets');
    }
    
    if (createTicketDto.candidate_id) {
      const candidate = await this.prisma.candidate.findUnique({
        where: { id: createTicketDto.candidate_id }
      });
      if (!candidate) {
        throw new BadRequestException('Candidate not found');
      }
    }

    let assignedValidatedUser;
    let assignedValidatedOrg;
    if (!user || user.role.includes("organization") && !user.organization_id) throw new BadRequestException('User organization not found');
    if (user.role.includes('organization')){
      //get the concierge client as assigned user
      const org = await this.prisma.organization.findUnique({
        where: { id: user.organization_id ||  undefined},
        select: { 
          admin_id: true,
          id: true
        }
      })
      if(!org) throw new BadRequestException('Organization not found')
        assignedValidatedUser = org.admin_id;
        assignedValidatedOrg = org.id;
      }else{
        assignedValidatedUser = createTicketDto.assigned_user_id;
        assignedValidatedOrg = createTicketDto.client_id;
      }
    
    try{
      const ticket = await this.prisma.ticket.create({
        data: {
          organization: { connect: { id: assignedValidatedOrg } },
          type: typeBE,
          title: createTicketDto.title,
          description: createTicketDto.description,
          priority: createTicketDto.priority as Priority,
          user: { connect: { id: assignedValidatedUser } } ,
          candidate: createTicketDto.candidate_id ? { connect: { id: createTicketDto.candidate_id } } : undefined,
        }
      })
      if(!ticket) throw new BadRequestException('Failed to create ticket')
      
      const ticketFull = await this.findOne(ticket.id)
      if (!ticketFull) throw new BadRequestException('Failed to retrieve full ticket');

      return ticketFull;

    }catch(error){
      throw new BadRequestException('Error creating ticket', error.message)
    }
  }

  async findAll(
    user: USER,
    type?: string,
    priority?: string,
    assigned_user_id?: string,
    search?: string,
    ): Promise<Object> {
    try{
      // Calculate date 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const tickets = await this.prisma.ticket.findMany({
        where:{
          type: type ? type : undefined,
          priority: priority ? priority as Priority : undefined,
          user: user.role === 'system_admin' ? { is : { id: user.id}} : undefined,
          OR: search ? [
            { organization: { name: { contains: search, mode: 'insensitive' } } },
            { title: { contains: search, mode: 'insensitive' } }
          ] : undefined,
          // Exclude tickets that are closed and were last updated more than 30 days ago
          NOT: {
            AND: [
              { status: 'closed' },
              { updatedAt: { lt: thirtyDaysAgo } }
            ]
          }
        },
        select:{
          id: true,
          type: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          createdAt: true,
          organization: {
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
              admin_id: true,
            }
          },
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
          }
        }
        
      })
      if(!tickets) throw new BadRequestException('Failed to fetch tickets')
      return tickets;
    }catch(error){
      throw new BadRequestException('Error fetching tickets')
    }
  }

  async reassing(id: string, data: reassignTicketDto): Promise<Object> {

    try{
      const currentTicket = await this.prisma.ticket.findUnique({
        where: { id },
        select: { 
          status: true,
        }
      })
      if(!currentTicket) throw new BadRequestException('Ticket not found')
      if(currentTicket.status !== 'new' && !data.assigned_user_id) throw new BadRequestException('Reassigning to unassigned is only allowed for NEW tickets');
      
      const ticketUpdated = await this.prisma.ticket.update({
        where: { id },
        data: {
          user: data.assigned_user_id ?  { connect: { id: data.assigned_user_id } } : { disconnect: true },
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
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      select: { 
        status: true,
        type: true,
        staff:{
          select:{
            id: true,
          }
        },
        user: { 
          select: { 
            id: true 
          } 
        }
      }
    })
    if(!ticket) throw new BadRequestException('Ticket not found')
    if(ticket.status === data.status) throw new BadRequestException(`Ticket is already in status: ${data.status}`)

    if(ticket.status === 'closed' && data.status=== 'resolved') throw new BadRequestException('Cannot change status from CLOSED to RESOLVED')
    if(ticket.status === 'new' && data.status=== 'in_progress' && !ticket.user?.id ||  ticket.status === 'new' && data.status=== 'resolved' && !ticket.user?.id) throw new BadRequestException(`Status ${data.status.replace("_"," ").toUpperCase()} requires an assigned user`)
    if (data.status === 'resolved' && ticket.type === 'termination' && ticket.staff?.id) {
      //terminate the staff => update staff status to terminated and terminated staff
      await this.prisma.staff.update({
        where:{
          id: ticket.staff.id,
        },
        data:{
          status: 'terminated',
          terminated_date: new Date()
        }
      })

    }
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
 
}
