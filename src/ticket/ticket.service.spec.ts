import { Test, TestingModule } from '@nestjs/testing';
import { TicketService } from './ticket.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BadRequestException } from '@nestjs/common';
import { Priority } from '@prisma/client';
import { ticketTypeDictionary } from '../common/dictionaries/ticket-type';

const userfake = { 
  id: '1',
  organization_id: 'org1',
  role: 'organization_admin',
  email: 'test@test.com',
  password: '',
  organization_name: 'Default Organization',
  first_name: 'John',
  last_name: 'Doe',
  phone: '',
  avatar: '',
  job_title: '',
  workos_id: '',
  authentication_method: 'OwnSign',
  status: 'active',
  is_organization_owner: false,
  verified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdByMethod: 'self_signup',
  createdByUserId: null,
  hubspot_id: '1'
}

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
      findUnique: jest.fn(),
      update: jest.fn(),
    }
  }

  const mockNotificationsService = {
    sendNotification: jest.fn(),
    createNotification: jest.fn(),
    getNotifications: jest.fn(),
    markAsRead: jest.fn(),
    deleteNotification: jest.fn(),
    notifyTicketEvent: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TicketService,
        {provide: PrismaService, useValue: mockPrisma},
        {provide: NotificationsService, useValue: mockNotificationsService}
      ],
    }).compile();

    service = module.get<TicketService>(TicketService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe.skip('Create', () => {
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
      (service as any).findOne = jest.fn().mockResolvedValue(mockTicketFull);
    });
  
    it('should create a ticket successfully and return full ticket', async () => {
      mockPrisma.ticket.create.mockResolvedValue(mockTicket);
  
      const result = await service.create(dto, userfake);
  
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
      expect((service as any).findOne).toHaveBeenCalledWith('1');
    });
  
    it('should create a ticket with type=null if type is invalid', async () => {
      const dtoInvalidType = { ...dto, type: 'invalid_type' };
      const mockTicketInvalid = { id: '2', ...dtoInvalidType, type: null };
      mockPrisma.ticket.create.mockResolvedValue(mockTicketInvalid);
  
      const result = await service.create(dtoInvalidType, userfake);
  
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
  
      const result = await service.create(dtoNoUser, userfake);
  
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
  
      await expect(service.create(dto, userfake)).rejects.toThrow(BadRequestException);
    });
  
    it('should throw BadRequestException if Prisma throws error', async () => {
      mockPrisma.ticket.create.mockRejectedValue(new Error('DB error'));
  
      await expect(service.create(dto, userfake)).rejects.toThrow(BadRequestException);
    });
  
    it('should throw BadRequestException if findOne returns null', async () => {
      mockPrisma.ticket.create.mockResolvedValue(mockTicket);
      (service as any).findOne = jest.fn().mockResolvedValue(null);
  
      await expect(service.create(dto, userfake)).rejects.toThrow(BadRequestException);
    });
  });
  
  
  describe('findAll', () => {
    const mockTickets = [{ id: 1, title: 'Ticket 1', candidate: null, staff: null  }];
  
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    it('should return all tickets without filters', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue(mockTickets);
  
      const result = await service.findAll(userfake, undefined, undefined, undefined, undefined);
  
      expect(result).toEqual(mockTickets);
      
      // Calculate expected 30 days ago date for comparison
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith({
        where: {
          type: undefined,
          priority: undefined,
          user: undefined,
          OR: undefined,
          // Exclude tickets that are closed and were last updated more than 30 days ago
          NOT: {
            AND: [
              { status: 'closed' },
              { updatedAt: { lt: expect.any(Date) } }
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
          },
          candidate: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              name: true,
              gender: true,
              avatar_url: true,
            }
          },
          staff: {
            select: {
              id: true,
              status: true,
              start_date: true,
              terminated_date: true,
              candidate: {
                select: {
                  id: true,
                  first_name: true,
                  last_name: true,
                  email: true,
                  name: true,
                  specialization: true,
                  years_of_experience: true,
                  gender: true,
                  avatar_url: true,
                }
              }
            }
          }
        }
      });
    });
  
    it('should apply type filter', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue(mockTickets);
  
      await service.findAll(userfake, 'bug', undefined, undefined, undefined);
  
      expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'bug' }),
        }),
      );
    });
  
    it('should apply priority filter', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue(mockTickets);
  
      await service.findAll(userfake, undefined, 'high', undefined, undefined);
  
      expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ priority: 'high' }),
        }),
      );
    });
  
    it('should apply assigned_user_id filter', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue(mockTickets);
  
      await service.findAll(userfake, undefined, undefined, 'user-123', undefined);
  
      expect(mockPrisma.ticket.findMany).toHaveBeenCalled();
    });
  
    it('should apply search filter to organization and title', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue(mockTickets);
  
      await service.findAll(userfake, undefined, undefined, undefined, 'test');
  
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
        service.findAll(userfake, undefined, undefined, undefined, undefined),
      ).rejects.toThrow(BadRequestException);
    });
  
    it('should throw BadRequestException if Prisma findMany fails', async () => {
      mockPrisma.ticket.findMany.mockRejectedValue(new Error('DB error'));
  
      await expect(
        service.findAll(userfake, undefined, undefined, undefined, undefined),
      ).rejects.toThrow(BadRequestException);
    });
  });
  
  describe('reassign', () => {
    const dto = { assigned_user_id: 'user1' };
    const ticketId = 'ticket123';
    const currentTicketmock = { status: 'open' };
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
  
    it('should throw BadRequestException if ticket not found', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValueOnce(null);
  
      await expect(service.reassing(ticketId, dto)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.ticket.findUnique).toHaveBeenCalledWith({
        where: { id: ticketId },
        select: { status: true },
      });
    });
  
    it('should throw BadRequestException if reassigning to unassigned for non-new ticket', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValueOnce({ status: 'open' });
  
      await expect(service.reassing(ticketId, { assigned_user_id: '' })).rejects.toThrow(
        BadRequestException,
      );
    });
  
    it('should throw BadRequestException if ticket update fails', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValueOnce(currentTicketmock);
      mockPrisma.ticket.update.mockResolvedValueOnce(null);
  
      await expect(service.reassing(ticketId, dto)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.ticket.update).toHaveBeenCalledWith({
        where: { id: ticketId },
        data: { user: { connect: { id: dto.assigned_user_id } } },
      });
    });
  
    it('should throw BadRequestException if fetching reassigned ticket fails', async () => {
      // 1ª chamada: currentTicket
      // 2ª chamada: findOne -> retorna null
      mockPrisma.ticket.findUnique
        .mockImplementationOnce(() => Promise.resolve(currentTicketmock))
        .mockImplementationOnce(() => Promise.resolve(null));
      
      mockPrisma.ticket.update.mockResolvedValueOnce(mockTicketUpdated);
  
      await expect(service.reassing(ticketId, dto)).rejects.toThrow(BadRequestException);
    });
  
    it('should reassign ticket successfully', async () => {
      mockPrisma.ticket.findUnique
        .mockImplementationOnce(() => Promise.resolve(currentTicketmock)) // currentTicket
        .mockImplementationOnce(() => Promise.resolve(mockTicketFinal)); // findOne
  
      mockPrisma.ticket.update.mockResolvedValueOnce(mockTicketUpdated);
  
      const result = await service.reassing(ticketId, dto);
  
      expect(result).toEqual(mockTicketFinal);
      expect(mockPrisma.ticket.update).toHaveBeenCalledWith({
        where: { id: ticketId },
        data: { user: { connect: { id: dto.assigned_user_id } } },
      });
    });
  
    it('should throw BadRequestException if Prisma throws error', async () => {
      mockPrisma.ticket.findUnique.mockRejectedValueOnce(new Error('DB error'));
  
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
