import { Test, TestingModule } from '@nestjs/testing';
import { TicketService } from './ticket.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { Priority } from '@prisma/client';
import { ticketTypeDictionary } from '../common/dictionaries/ticket-type';

describe('TicketService', () => {
  let service: TicketService;
  let prisma: PrismaService;

  const mockPrisma = {
    ticket: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    uSER:{
      findUnique: jest.fn(),
    },
    staff :{
      update: jest.fn(),
    }
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TicketService,
        {provide: PrismaService, useValue: mockPrisma}
      ],
    }).compile();

    service = module.get<TicketService>(TicketService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Create', () => {
    const dto = {
      client_id: 'client1',
      type: 'issue',
      title: 'Ticket title',
      description: 'Ticket description',
      priority: 'HIGH' as Priority,
      assigned_user_id: 'user1',
    };
  
    const mockTicket = { id: '1', ...dto, type: ticketTypeDictionary[dto.type] ?? null };
    const mockTicketFull = { id: '1', title: 'Ticket title', status: 'open' };
  
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    it('should create a ticket successfully and return full ticket', async () => {
      mockPrisma.ticket.create.mockResolvedValue(mockTicket);
      mockPrisma.ticket.findUnique.mockResolvedValue(mockTicketFull);
  
      const result = await service.create(dto);
  
      expect(result).toEqual(mockTicketFull);
      expect(mockPrisma.ticket.create).toHaveBeenCalledWith({
        data: {
          organization: { connect: { id: dto.client_id } },
          type: ticketTypeDictionary[dto.type] ?? null,
          title: dto.title,
          description: dto.description,
          priority: dto.priority,
          user: { connect: { id: dto.assigned_user_id } },
        },
      });
      expect(mockPrisma.ticket.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: '1' } }));
    });
  
    it('should create a ticket with type=null if type is invalid', async () => {
      const dtoInvalidType = { ...dto, type: 'invalid_type' };
      const mockTicketInvalid = { id: '2', ...dtoInvalidType, type: null };
      mockPrisma.ticket.create.mockResolvedValue(mockTicketInvalid);
      mockPrisma.ticket.findUnique.mockResolvedValue(mockTicketFull);
  
      const result = await service.create(dtoInvalidType);
  
      expect(result).toEqual(mockTicketFull);
      expect(mockPrisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: null }),
        }),
      );
    });
  
    it('should create a ticket without assigned user', async () => {
      const dtoNoUser = { ...dto, assigned_user_id: '' };
      const mockTicketNoUser = { id: '3', ...dtoNoUser, type: ticketTypeDictionary[dto.type] ?? null };
      mockPrisma.ticket.create.mockResolvedValue(mockTicketNoUser);
      mockPrisma.ticket.findUnique.mockResolvedValue(mockTicketFull);
  
      const result = await service.create(dtoNoUser);
  
      expect(result).toEqual(mockTicketFull);
      expect(mockPrisma.ticket.create).toHaveBeenCalledWith({
        data: {
          organization: { connect: { id: dto.client_id } },
          type: ticketTypeDictionary[dto.type] ?? null,
          title: dto.title,
          description: dto.description,
          priority: dto.priority,
          user: undefined,
        },
      });
    });
  
    it('should throw BadRequestException if ticket is null', async () => {
      mockPrisma.ticket.create.mockResolvedValue(null);
  
      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });
  
    it('should throw BadRequestException if Prisma throws error', async () => {
      mockPrisma.ticket.create.mockRejectedValue(new Error('DB error'));
  
      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });
  
    it('should throw BadRequestException if findOne (findUnique) returns null', async () => {
      mockPrisma.ticket.create.mockResolvedValue(mockTicket);
      mockPrisma.ticket.findUnique.mockResolvedValue(null);
  
      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });
  });
  
  
  
  describe('findAll', () => {
    const mockTickets = [{ id: 1, title: 'Ticket 1' }];
  
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    it('should return all tickets without filters', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue(mockTickets);
  
      const result = await service.findAll(undefined, undefined, undefined, undefined);
  
      expect(result).toEqual(mockTickets);
      expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith({
        where: {
          type: undefined,
          priority: undefined,
          user: undefined,
          OR: undefined,
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
              type: true,
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
      });
    });
  
    it('should apply type filter', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue(mockTickets);
  
      await service.findAll('bug', undefined, undefined, undefined);
  
      expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'bug' }),
        }),
      );
    });
  
    it('should apply priority filter', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue(mockTickets);
  
      await service.findAll(undefined, 'high', undefined, undefined);
  
      expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ priority: 'high' }),
        }),
      );
    });
  
    it('should apply assigned_user_id filter', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue(mockTickets);
  
      await service.findAll(undefined, undefined, 'user-123', undefined);
  
      expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user: { is: { id: 'user-123' } },
          }),
        }),
      );
    });
  
    it('should apply search filter to organization and title', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue(mockTickets);
  
      await service.findAll(undefined, undefined, undefined, 'test');
  
      expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { organization: { name: { contains: 'test', mode: 'insensitive' } } },
              { title: { contains: 'test', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });
  
    it('should throw BadRequestException if tickets is null', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue(null);
  
      await expect(
        service.findAll(undefined, undefined, undefined, undefined),
      ).rejects.toThrow(BadRequestException);
    });
  
    it('should throw BadRequestException if Prisma findMany fails', async () => {
      mockPrisma.ticket.findMany.mockRejectedValue(new Error('DB error'));
  
      await expect(
        service.findAll(undefined, undefined, undefined, undefined),
      ).rejects.toThrow(BadRequestException);
    });
  });
  
  describe('reassign', () => {
    const dto = { assigned_user_id: 'user1' };
    const ticketId = 'ticket123';
    const mockUser = { id: 'user1', first_name: 'John' };
    const mockTicketUpdated = { id: ticketId };
    const mockTicketFinal = {
      id: ticketId,
      organization: { id: 'org1', name: 'Org 1' },
      user: {
        id: 'user1',
        first_name: 'John',
        last_name: 'Doe',
        job_title: 'Dev',
        role: 'Admin',
        status: 'ACTIVE',
        email: 'john@example.com',
      },
    };
  
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    it('should throw BadRequestException if user to assign not found', async () => {
      mockPrisma.uSER.findUnique.mockResolvedValue(null);
  
      await expect(service.reassing(ticketId, dto)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.uSER.findUnique).toHaveBeenCalledWith({
        where: { id: dto.assigned_user_id },
      });
    });
  
    it('should throw BadRequestException if ticket update fails', async () => {
      mockPrisma.uSER.findUnique.mockResolvedValue(mockUser);
      mockPrisma.ticket.update.mockResolvedValue(null);
  
      await expect(service.reassing(ticketId, dto)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.ticket.update).toHaveBeenCalledWith({
        where: { id: ticketId },
        data: { user: { connect: { id: dto.assigned_user_id } } },
      });
    });
  
    it('should throw BadRequestException if fetching reassigned ticket fails', async () => {
      mockPrisma.uSER.findUnique.mockResolvedValue(mockUser);
      mockPrisma.ticket.update.mockResolvedValue(mockTicketUpdated);
      mockPrisma.ticket.findUnique.mockResolvedValue(null); // <--- retorna null para simular falha
    
      await expect(service.reassing(ticketId, dto)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.ticket.findUnique).toHaveBeenCalledWith({
        where: { id: ticketId },
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
              type: true,
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
      });
    });
    
  
    it('should reassign ticket successfully', async () => {
      mockPrisma.uSER.findUnique.mockResolvedValue(mockUser);
      mockPrisma.ticket.update.mockResolvedValue(mockTicketUpdated);
      mockPrisma.ticket.findUnique.mockResolvedValue(mockTicketFinal);
  
      const result = await service.reassing(ticketId, dto);
  
      expect(result).toEqual(mockTicketFinal);
      expect(mockPrisma.uSER.findUnique).toHaveBeenCalledWith({
        where: { id: dto.assigned_user_id },
      });
      expect(mockPrisma.ticket.update).toHaveBeenCalledWith({
        where: { id: ticketId },
        data: { user: { connect: { id: dto.assigned_user_id } } },
      });
      expect(mockPrisma.ticket.findUnique).toHaveBeenCalledWith({
        where: { id: ticketId },
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
              type: true,
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
      });
      
    });
  
    it('should throw BadRequestException if Prisma throws error', async () => {
      mockPrisma.uSER.findUnique.mockRejectedValue(new Error('DB error'));
  
      await expect(service.reassing(ticketId, dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateStatus', () => {
    const ticketId = 'ticket123';
    const newStatus = 'in_progress';
    const mockTicketUpdated = { id: ticketId, status: newStatus };
    const mockTicketFinal = {
      id: 'ticket123',
      status: 'in_progress',
      type: 'termination',
      staff: { id: 'staff1' },
      user: { id: 'user1' },
    };
    
  
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    it('should throw if ticket not found', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(null);
  
      await expect(service.updateStatus(ticketId, { status: newStatus }))
        .rejects.toThrow('Ticket not found');
    });
  
    it('should throw if status is the same', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({ status: newStatus });
  
      await expect(service.updateStatus(ticketId, { status: newStatus }))
        .rejects.toThrow(`Ticket is already in status: ${newStatus}`);
    });
  
    it('should throw if changing from closed to resolved', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({ status: 'closed' });
  
      await expect(service.updateStatus(ticketId, { status: 'resolved' }))
        .rejects.toThrow('Cannot change status from CLOSED to RESOLVED');
    });
  
    it('should throw if going new→in_progress without assigned user', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({ status: 'new', user: null });
  
      await expect(service.updateStatus(ticketId, { status: 'in_progress' }))
        .rejects.toThrow('Status IN PROGRESS requires an assigned user');
    });
  
    it('should throw if going new→resolved without assigned user', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({ status: 'new', user: null });
  
      await expect(service.updateStatus(ticketId, { status: 'resolved' }))
        .rejects.toThrow('Status RESOLVED requires an assigned user');
    });
  
    it('should terminate staff when resolving termination ticket', async () => {
      mockPrisma.ticket.findUnique
        .mockResolvedValueOnce({
          status: 'open',
          type: 'termination',
          staff: { id: 'staff1' },
          user: { id: 'user1' },
        })
        .mockResolvedValueOnce(mockTicketFinal);
      mockPrisma.staff.update.mockResolvedValue({ id: 'staff1', status: 'terminated' });
      mockPrisma.ticket.update.mockResolvedValue(mockTicketUpdated);
  
      const result = await service.updateStatus(ticketId, { status: 'resolved' });
  
      expect(mockPrisma.staff.update).toHaveBeenCalledWith({
        where: { id: 'staff1' },
        data: expect.objectContaining({ status: 'terminated' }),
      });
      expect(result).toEqual(mockTicketFinal);
    });
  
    it('should throw if ticket update returns null', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({ status: 'open', user: { id: 'u1' } });
      mockPrisma.ticket.update.mockResolvedValue(null);
  
      await expect(service.updateStatus(ticketId, { status: newStatus }))
        .rejects.toThrow('Error updating ticket status');
    });
  
    it('should throw if findOne returns null after update', async () => {
      mockPrisma.ticket.findUnique
        .mockResolvedValueOnce({ status: 'open', user: { id: 'u1' } }) 
        .mockResolvedValueOnce(null);
      mockPrisma.ticket.update.mockResolvedValue(mockTicketUpdated);
  
      await expect(service.updateStatus(ticketId, { status: newStatus }))
        .rejects.toThrow('Error updating ticket status');
    });
  
    it('should update ticket successfully', async () => {
      mockPrisma.ticket.findUnique
        .mockResolvedValueOnce({ status: 'open', user: { id: 'u1' } })
        .mockResolvedValueOnce({ id: ticketId, status: newStatus, user: { id: 'u1' } });

      mockPrisma.ticket.update.mockResolvedValue(mockTicketUpdated);
  
      const result = await service.updateStatus(ticketId, { status: newStatus });
  
      expect(result).toMatchObject({
        id: 'ticket123',
        status: 'in_progress',
      });
      expect(mockPrisma.ticket.update).toHaveBeenCalledWith({
        where: { id: ticketId },
        data: { status: newStatus },
      });
    });
  
    it('should throw BadRequestException if Prisma throws error', async () => {
      // ticket encontrado normalmente
      mockPrisma.ticket.findUnique.mockResolvedValue({ id: ticketId, status: 'open' });
    
      // mas update falha
      mockPrisma.ticket.update.mockRejectedValue(new Error('DB error'));
    
      await expect(service.updateStatus(ticketId, { status: newStatus }))
        .rejects.toThrow('Error updating ticket status');
    });
    
  });
  
  

});
