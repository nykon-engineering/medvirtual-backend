import { Test, TestingModule } from '@nestjs/testing';
import { HireRequestService } from './hire-request.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { USER } from '@prisma/client';

const prismaMock = {
  hireRequest: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  hireRequestSkill: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
};

describe('HireRequestService', () => {
  let service: HireRequestService;
  let user: USER;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HireRequestService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<HireRequestService>(HireRequestService);
    user = {
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
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } ;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create hire request with skills', async () => {
      prismaMock.hireRequest.create.mockResolvedValue({ id: 'hr1' });
      prismaMock.hireRequestSkill.createMany.mockResolvedValue({ count: 2 });

      const dto = {
        title: 'Dev',
        skills: [
          { name: 'JS', level: 'advanced' },
          { name: 'TS', level: 'intermediate' },
        ],
      };

      const result = await service.create(dto as any, user);
      expect(result).toBe('Hire request created successfully');
      expect(prismaMock.hireRequest.create).toHaveBeenCalled();
      expect(prismaMock.hireRequestSkill.createMany).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user has no org', async () => {
      await expect(service.create({} as any, { ...user, organization_id: null }))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return hire requests', async () => {
      prismaMock.hireRequest.findMany.mockResolvedValue([{ id: 'hr1' }]);
      const result = await service.findAll(user);
      expect(result).toEqual([{ id: 'hr1' }]);
    });

    it('should throw NotFoundException if no org', async () => {
      await expect(service.findAll({ ...user, organization_id: null }))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if role missing', async () => {
      await expect(service.findAll({ ...user, role: '' }))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if no results', async () => {
      prismaMock.hireRequest.findMany.mockResolvedValue(null);
      await expect(service.findAll(user))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('should return hire request', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue({ id: 'hr1' });
      const result = await service.findOne('hr1', user);
      expect(result).toEqual({ id: 'hr1' });
    });

    it('should throw NotFoundException if no org', async () => {
      await expect(service.findOne('hr1', { ...user, organization_id: null }))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if not found', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue(null);
      await expect(service.findOne('hr1', user))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update hire request with skills', async () => {
      prismaMock.hireRequest.update.mockResolvedValue({ id: 'hr1' });
      prismaMock.hireRequestSkill.deleteMany.mockResolvedValue({});
      prismaMock.hireRequestSkill.createMany.mockResolvedValue({ count: 2 });

      const dto = {
        title: 'Updated',
        skills: [{ name: 'JS', level: 'advanced' }],
      };

      const result = await service.update('hr1', dto as any, user);
      expect(result).toHaveProperty('id');
      expect(prismaMock.hireRequest.update).toHaveBeenCalled();
      expect(prismaMock.hireRequestSkill.deleteMany).toHaveBeenCalled();
      expect(prismaMock.hireRequestSkill.createMany).toHaveBeenCalled();
    });

    it('should throw NotFoundException if no org', async () => {
      await expect(service.update('hr1', {} as any, { ...user, organization_id: null }))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if update fails', async () => {
      prismaMock.hireRequest.update.mockResolvedValue(null);
      await expect(service.update('hr1', {} as any, user))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if skills update fails', async () => {
      prismaMock.hireRequest.update.mockResolvedValue({ id: 'hr1' });
      prismaMock.hireRequestSkill.deleteMany.mockResolvedValue({});
      prismaMock.hireRequestSkill.createMany.mockResolvedValue(null);

      await expect(
        service.update('hr1', { skills: [{ name: 'JS', level: 'advanced' }] } as any, user)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should delete hire request', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue({ id: 'hr1' });
      prismaMock.hireRequest.delete.mockResolvedValue({ id: 'hr1' });

      const result = await service.remove('hr1', user);
      expect(result).toBe(true);
      expect(prismaMock.hireRequest.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if no org', async () => {
      await expect(service.remove('hr1', { ...user, organization_id: null }))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if not found', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue(null);
      await expect(service.remove('hr1', user))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if delete fails', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue({ id: 'hr1' });
      prismaMock.hireRequest.delete.mockResolvedValue(null);
      await expect(service.remove('hr1', user))
        .rejects.toThrow(BadRequestException);
    });
  });
});
