import { Test, TestingModule } from '@nestjs/testing';
import { TicketService } from './ticket.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { Priority } from '@prisma/client';

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

  describe('create', () => {
    const dto = {
      client_id: 'client1',
      type: 'issue',
      title: 'Ticket title',
      description: 'Ticket description',
      priority: 'HIGH' as Priority,
      assign_id: 'user1',
    };

    it('should create a ticket successfully', async () => {
      mockPrisma.ticket.create.mockResolvedValue({ id: 1, ...dto });

      const result = await service.create(dto);
      expect(result).toEqual({ id: 1, ...dto });
      expect(mockPrisma.ticket.create).toHaveBeenCalledWith({
        data: {
          organization: { connect: { id: dto.client_id } },
          type: dto.type,
          title: dto.title,
          description: dto.description,
          priority: dto.priority,
          user: { connect: { id: dto.assign_id } },
        },
      });
    });

    it('should throw BadRequestException if Prisma create fails', async () => {
      mockPrisma.ticket.create.mockRejectedValue(new Error('DB error'));

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return all tickets', async () => {
      const tickets = [{ id: 1, title: 'Ticket 1' }];
      mockPrisma.ticket.findMany.mockResolvedValue(tickets);

      const result = await service.findAll();
      expect(result).toEqual(tickets);
      expect(mockPrisma.ticket.findMany).toHaveBeenCalled();
    });

    it('should throw BadRequestException if Prisma findMany fails', async () => {
      mockPrisma.ticket.findMany.mockRejectedValue(new Error('DB error'));

      await expect(service.findAll()).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should return a string with ticket id', () => {
      expect(service.findOne(1)).toBe('This action returns a #1 ticket');
    });
  });

  describe('update', () => {
    it('should return a string with updated ticket id', () => {
      expect(service.update(1, { title: 'Updated' })).toBe(
        'This action updates a #1 ticket',
      );
    });
  });

  describe('remove', () => {
    it('should return a string with removed ticket id', () => {
      expect(service.remove(1)).toBe('This action removes a #1 ticket');
    });
  });
});
