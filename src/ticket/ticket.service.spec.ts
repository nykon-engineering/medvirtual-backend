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
    },
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
      assign_user_id: 'user1',
    };
  
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    it('should create a ticket successfully', async () => {
      const expected = { id: 1, ...dto, type: ticketTypeDictionary[dto.type] ?? null };
    
      mockPrisma.ticket.create.mockResolvedValue(expected);
    
      const result = await service.create(dto);
    
      expect(result).toEqual(expected);
      expect(mockPrisma.ticket.create).toHaveBeenCalledWith({
        data: {
          organization: { connect: { id: dto.client_id } },
          type: ticketTypeDictionary[dto.type] ?? null, // <-- garante compatibilidade com o service
          title: dto.title,
          description: dto.description,
          priority: dto.priority,
          user: { connect: { id: dto.assign_user_id } },
        },
      });
    });
    
  
    it('should create a ticket with type=null if type is not in dictionary', async () => {
      const dtoInvalidType = { ...dto, type: 'invalid_type' };
      const expected = { id: 2, ...dtoInvalidType, type: null };
  
      mockPrisma.ticket.create.mockResolvedValue(expected);
  
      const result = await service.create(dtoInvalidType);
  
      expect(result).toEqual(expected);
      expect(mockPrisma.ticket.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: null,
        }),
      });
    });
  
    it('should create a ticket without assign_user_id', async () => {
      const dtoNoUser = { ...dto, assign_user_id: "" };
      const expected = { id: 3, ...dtoNoUser, type: ticketTypeDictionary[dto.type] ?? null };
    
      mockPrisma.ticket.create.mockResolvedValue(expected);
    
      const result = await service.create(dtoNoUser);
    
      expect(result).toEqual(expected);
      expect(mockPrisma.ticket.create).toHaveBeenCalledWith({
        data: {
          organization: { connect: { id: dto.client_id } },
          type: ticketTypeDictionary[dto.type] ?? null, // <-- corrigido
          title: dto.title,
          description: dto.description,
          priority: dto.priority,
          user: undefined,
        },
      });
    });
    
  
    it('should throw BadRequestException if Prisma returns null', async () => {
      mockPrisma.ticket.create.mockResolvedValue(null);
  
      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });
  
    it('should throw BadRequestException if Prisma create fails', async () => {
      mockPrisma.ticket.create.mockRejectedValue(new Error('DB error'));
  
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
  
    it('should apply assign_user_id filter', async () => {
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
  

  describe('remove', () => {
    it('should return a string with removed ticket id', () => {
      expect(service.remove(1)).toBe('This action removes a #1 ticket');
    });
  });
});
