import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { TalentPoolLeadsService } from './talent-pool-leads.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTalentPoolLeadDto } from './dto/create-talent-pool-lead.dto';
import { UpdateTalentPoolLeadDto } from './dto/update-talent-pool-lead.dto';
import { QueryTalentPoolLeadsDto } from './dto/query-talent-pool-leads.dto';

const mockPrisma = {
  talentPoolLead: {
    count: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  uSER: {
    findUnique: jest.fn(),
  },
};

describe('TalentPoolLeadsService', () => {
  let service: TalentPoolLeadsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TalentPoolLeadsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TalentPoolLeadsService>(TalentPoolLeadsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateTalentPoolLeadDto = {
      name: 'John Doe',
      email: 'john@healthcare.com',
      organization: 'Healthcare Organization',
      main_need: '3 bilingual VAs',
      additional_details: 'Monthly volume details',
      source: 'talent-pool-page',
    };

    it('should create a new talent pool lead successfully', async () => {
      const mockCreatedLead = {
        id: 'lead-1',
        name: 'John Doe',
        email: 'john@healthcare.com',
        organization: 'Healthcare Organization',
        status: 'new',
        created_at: new Date('2024-01-15T10:30:00Z'),
      };

      mockPrisma.talentPoolLead.count.mockResolvedValue(0); // Rate limit check passes
      mockPrisma.talentPoolLead.findFirst.mockResolvedValue(null); // No duplicate
      mockPrisma.talentPoolLead.create.mockResolvedValue(mockCreatedLead);

      const result = await service.create(createDto);

      expect(mockPrisma.talentPoolLead.count).toHaveBeenCalled();
      expect(mockPrisma.talentPoolLead.findFirst).toHaveBeenCalledWith({
        where: {
          email: 'john@healthcare.com',
          source: 'talent-pool-page',
        },
      });
      expect(mockPrisma.talentPoolLead.create).toHaveBeenCalled();
      expect(result).toEqual(mockCreatedLead);
    });

    it('should throw ConflictException if lead with same email and source exists', async () => {
      const existingLead = {
        id: 'existing-lead',
        email: 'john@healthcare.com',
        source: 'talent-pool-page',
      };

      mockPrisma.talentPoolLead.count.mockResolvedValue(0);
      mockPrisma.talentPoolLead.findFirst.mockResolvedValue(existingLead);

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        'Lead with this email already exists for this source',
      );
    });

    it('should throw BadRequestException if rate limit exceeded (3 submissions per day)', async () => {
      mockPrisma.talentPoolLead.count.mockResolvedValue(3); // Already 3 submissions today

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        'Maximum 3 submissions per email per day',
      );
    });

    it('should sanitize input to prevent XSS', async () => {
      const maliciousDto: CreateTalentPoolLeadDto = {
        name: '<script>alert("xss")</script>John',
        email: 'john@healthcare.com',
        organization: 'Healthcare Org',
        source: 'talent-pool-page',
      };

      mockPrisma.talentPoolLead.count.mockResolvedValue(0);
      mockPrisma.talentPoolLead.findFirst.mockResolvedValue(null);
      mockPrisma.talentPoolLead.create.mockResolvedValue({
        id: 'lead-1',
        name: '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;John',
        email: 'john@healthcare.com',
        organization: 'Healthcare Org',
        status: 'new',
        created_at: new Date(),
      });

      const result = await service.create(maliciousDto);

      expect(mockPrisma.talentPoolLead.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: expect.stringContaining('&lt;script&gt;'),
        }),
        select: expect.objectContaining({
          id: true,
          name: true,
          email: true,
          organization: true,
          status: true,
          created_at: true,
        }),
      });
    });

    it('should normalize email to lowercase and trim', async () => {
      const dtoWithUpperCaseEmail: CreateTalentPoolLeadDto = {
        ...createDto,
        email: '  JOHN@HEALTHCARE.COM  ',
      };

      mockPrisma.talentPoolLead.count.mockResolvedValue(0);
      mockPrisma.talentPoolLead.findFirst.mockResolvedValue(null);
      mockPrisma.talentPoolLead.create.mockResolvedValue({
        id: 'lead-1',
        email: 'john@healthcare.com',
        name: 'John Doe',
        organization: 'Healthcare Organization',
        status: 'new',
        created_at: new Date(),
      });

      await service.create(dtoWithUpperCaseEmail);

      expect(mockPrisma.talentPoolLead.findFirst).toHaveBeenCalledWith({
        where: {
          email: 'john@healthcare.com',
          source: 'talent-pool-page',
        },
      });
      expect(mockPrisma.talentPoolLead.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'john@healthcare.com',
        }),
        select: expect.objectContaining({
          id: true,
          name: true,
          email: true,
          organization: true,
          status: true,
          created_at: true,
        }),
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated leads with default pagination', async () => {
      const mockLeads = [
        {
          id: 'lead-1',
          name: 'John Doe',
          email: 'john@example.com',
          organization: 'Org 1',
          main_need: 'Need 1',
          additional_details: 'Details 1',
          source: 'talent-pool-page',
          status: 'new',
          assigned_to_user_id: null,
          notes: null,
          created_at: new Date('2024-01-15'),
          updated_at: new Date('2024-01-15'),
          contacted_at: null,
          assignedTo: null,
        },
        {
          id: 'lead-2',
          name: 'Jane Smith',
          email: 'jane@example.com',
          organization: 'Org 2',
          main_need: 'Need 2',
          additional_details: 'Details 2',
          source: 'berry-talent-pool-page',
          status: 'contacted',
          assigned_to_user_id: 'user-1',
          notes: 'Called',
          created_at: new Date('2024-01-14'),
          updated_at: new Date('2024-01-14'),
          contacted_at: new Date('2024-01-14'),
          assignedTo: {
            id: 'user-1',
            first_name: 'Admin',
            last_name: 'User',
            email: 'admin@example.com',
          },
        },
      ];

      mockPrisma.talentPoolLead.count.mockResolvedValue(2);
      mockPrisma.talentPoolLead.findMany.mockResolvedValue(mockLeads);

      const query: QueryTalentPoolLeadsDto = {};
      const result = await service.findAll(query);

      expect(mockPrisma.talentPoolLead.count).toHaveBeenCalledWith({
        where: {},
      });
      expect(mockPrisma.talentPoolLead.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { created_at: 'desc' },
        include: {
          assignedTo: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
        },
      });
      expect(result.data).toHaveLength(2);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      });
      expect(result.data[1].assigned_to_user).toEqual({
        id: 'user-1',
        name: 'Admin User',
        email: 'admin@example.com',
      });
    });

    it('should filter by status', async () => {
      mockPrisma.talentPoolLead.count.mockResolvedValue(5);
      mockPrisma.talentPoolLead.findMany.mockResolvedValue([]);

      const query: QueryTalentPoolLeadsDto = { status: 'contacted' };
      await service.findAll(query);

      expect(mockPrisma.talentPoolLead.count).toHaveBeenCalledWith({
        where: { status: 'contacted' },
      });
      expect(mockPrisma.talentPoolLead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'contacted' },
        }),
      );
    });

    it('should filter by source', async () => {
      mockPrisma.talentPoolLead.count.mockResolvedValue(3);
      mockPrisma.talentPoolLead.findMany.mockResolvedValue([]);

      const query: QueryTalentPoolLeadsDto = {
        source: 'talent-pool-page',
      };
      await service.findAll(query);

      expect(mockPrisma.talentPoolLead.count).toHaveBeenCalledWith({
        where: { source: 'talent-pool-page' },
      });
    });

    it('should search by name, email, or organization', async () => {
      mockPrisma.talentPoolLead.count.mockResolvedValue(1);
      mockPrisma.talentPoolLead.findMany.mockResolvedValue([]);

      const query: QueryTalentPoolLeadsDto = { search: 'John' };
      await service.findAll(query);

      expect(mockPrisma.talentPoolLead.count).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: 'John', mode: 'insensitive' } },
            { email: { contains: 'John', mode: 'insensitive' } },
            { organization: { contains: 'John', mode: 'insensitive' } },
          ],
        },
      });
    });

    it('should handle pagination correctly', async () => {
      mockPrisma.talentPoolLead.count.mockResolvedValue(50);
      mockPrisma.talentPoolLead.findMany.mockResolvedValue([]);

      const query: QueryTalentPoolLeadsDto = { page: 2, limit: 10 };
      const result = await service.findAll(query);

      expect(mockPrisma.talentPoolLead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
      expect(result.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 50,
        totalPages: 5,
      });
    });
  });

  describe('update', () => {
    const existingLead = {
      id: 'lead-1',
      name: 'John Doe',
      email: 'john@example.com',
      organization: 'Org',
      status: 'new',
      contacted_at: null,
      assigned_to_user_id: null,
      notes: null,
    };

    it('should update lead status successfully', async () => {
      const updateDto: UpdateTalentPoolLeadDto = { status: 'contacted' };
      const updatedLead = {
        ...existingLead,
        status: 'contacted',
        contacted_at: new Date(),
        updated_at: new Date(),
        assignedTo: null,
      };

      mockPrisma.talentPoolLead.findUnique.mockResolvedValue(existingLead);
      mockPrisma.talentPoolLead.update.mockResolvedValue(updatedLead);

      const result = await service.update('lead-1', updateDto);

      expect(mockPrisma.talentPoolLead.findUnique).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
      });
      expect(mockPrisma.talentPoolLead.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: {
          status: 'contacted',
          contacted_at: expect.any(Date),
        },
        include: {
          assignedTo: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
        },
      });
      expect(result.status).toBe('contacted');
      expect(result.contacted_at).toBeDefined();
    });

    it('should update notes', async () => {
      const updateDto: UpdateTalentPoolLeadDto = {
        notes: 'Called on 2024-01-16',
      };
      const updatedLead = {
        ...existingLead,
        notes: 'Called on 2024-01-16',
        updated_at: new Date(),
        assignedTo: null,
      };

      mockPrisma.talentPoolLead.findUnique.mockResolvedValue(existingLead);
      mockPrisma.talentPoolLead.update.mockResolvedValue(updatedLead);

      const result = await service.update('lead-1', updateDto);

      expect(result.notes).toBe('Called on 2024-01-16');
    });

    it('should update assigned user', async () => {
      const updateDto: UpdateTalentPoolLeadDto = {
        assigned_to_user_id: 'user-1',
      };
      const mockUser = {
        id: 'user-1',
        first_name: 'Admin',
        last_name: 'User',
        email: 'admin@example.com',
      };
      const updatedLead = {
        ...existingLead,
        assigned_to_user_id: 'user-1',
        updated_at: new Date(),
        assignedTo: mockUser,
      };

      mockPrisma.talentPoolLead.findUnique.mockResolvedValue(existingLead);
      mockPrisma.uSER.findUnique.mockResolvedValue(mockUser);
      mockPrisma.talentPoolLead.update.mockResolvedValue(updatedLead);

      const result = await service.update('lead-1', updateDto);

      expect(mockPrisma.uSER.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(result.assigned_to_user_id).toBe('user-1');
      expect(result.assigned_to_user).toEqual({
        id: 'user-1',
        name: 'Admin User',
        email: 'admin@example.com',
      });
    });

    it('should throw NotFoundException if lead does not exist', async () => {
      mockPrisma.talentPoolLead.findUnique.mockResolvedValue(null);

      const updateDto: UpdateTalentPoolLeadDto = { status: 'contacted' };

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.update('non-existent', updateDto)).rejects.toThrow(
        'Lead not found',
      );
    });

    it('should throw BadRequestException if assigned user does not exist', async () => {
      const updateDto: UpdateTalentPoolLeadDto = {
        assigned_to_user_id: 'non-existent-user',
      };

      mockPrisma.talentPoolLead.findUnique.mockResolvedValue(existingLead);
      mockPrisma.uSER.findUnique.mockResolvedValue(null);

      await expect(service.update('lead-1', updateDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.update('lead-1', updateDto)).rejects.toThrow(
        'Assigned user not found',
      );
    });

    it('should not set contacted_at if status is not changed to contacted', async () => {
      const updateDto: UpdateTalentPoolLeadDto = { status: 'qualified' };
      const updatedLead = {
        ...existingLead,
        status: 'qualified',
        contacted_at: null,
        updated_at: new Date(),
        assignedTo: null,
      };

      mockPrisma.talentPoolLead.findUnique.mockResolvedValue(existingLead);
      mockPrisma.talentPoolLead.update.mockResolvedValue(updatedLead);

      const result = await service.update('lead-1', updateDto);

      expect(mockPrisma.talentPoolLead.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: {
          status: 'qualified',
        },
        include: expect.any(Object),
      });
      expect(result.contacted_at).toBeNull();
    });

    it('should not update contacted_at if already set', async () => {
      const leadWithContactedAt = {
        ...existingLead,
        contacted_at: new Date('2024-01-10'),
      };
      const updateDto: UpdateTalentPoolLeadDto = { status: 'contacted' };
      const updatedLead = {
        ...leadWithContactedAt,
        status: 'contacted',
        updated_at: new Date(),
        assignedTo: null,
      };

      mockPrisma.talentPoolLead.findUnique.mockResolvedValue(leadWithContactedAt);
      mockPrisma.talentPoolLead.update.mockResolvedValue(updatedLead);

      await service.update('lead-1', updateDto);

      // Should not set contacted_at again since it's already set
      expect(mockPrisma.talentPoolLead.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: {
          status: 'contacted',
          // contacted_at should not be in the update data
        },
        include: expect.any(Object),
      });
    });
  });
});

