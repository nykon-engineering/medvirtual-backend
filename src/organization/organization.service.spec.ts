// organization.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationService } from './organization.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';


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
  assigned_system_admin: null,
  client_activated_at: null,
  document_signed_at: null,
  panda_doc_signed_url: null,
  prospect_created_at: null,
  status: 'active',
  is_organization_owner: false,
  userRole: UserRole.prospect,
  verified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe.skip('OrganizationService', () => {
  let service: OrganizationService;
  let prisma: PrismaService;

  const mockPrismaService = {
    organization: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
    uSER: {
      updateMany: jest.fn(),
    },
  };

  const mockAuthService = {
    inviteUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
    prisma = module.get<PrismaService>(PrismaService);

    mockPrismaService.$transaction = jest.fn(async (operations) => {
      if (Array.isArray(operations)) {
        return Promise.all(operations);
      }

      if (typeof operations === 'function') {
        return operations(mockPrismaService);
      }
      return true;
    });
    
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  describe.skip('getAll', () => {
    it('should return an array of organizations', async () => {
      const organizations = [
        { id: '1', name: 'Org 1', contact_info: '123', email: 'org1@example.com' },
        { id: '2', name: 'Org 2', contact_info: '567', email: 'org2@example.com' },
      ];

      mockPrismaService.organization.findMany.mockResolvedValue(organizations);

      const result = await service.getAll(userfake);
      expect(result).toEqual(organizations);
      expect(prisma.organization.findMany).toHaveBeenCalled();
    });

    it('should throw NotFoundException if an error occurs', async () => {
      mockPrismaService.organization.findMany.mockRejectedValue(new Error());

      await expect(service.getAll(userfake)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getById', () => {
    it('should return an organization by id', async () => {
      const org = { id: '1', name: 'Org 1', contact_info: '123', email: 'org1@example.com' };

      mockPrismaService.organization.findUnique.mockResolvedValue(org);

      const result = await service.getById('1');
      expect(result).toEqual(org);
    });

    it('should throw NotFoundException if organization not found', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue(null);

      await expect(service.getById('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if error occurs', async () => {
      mockPrismaService.organization.findUnique.mockRejectedValue(new Error());

      await expect(service.getById('1')).rejects.toThrow(NotFoundException);
    });
  });
  /*
  describe('create', () => {
    it('should create and return a new organization', async () => {
      const dto = { name: 'Org 1', cellphone: '123', email: 'org1@example.com', super_admin_email: 'admin@admin' , admin_id: '1' };
      const created = { id: '1', name: dto.name, contact_info: dto.cellphone, email: dto.email };

      mockPrismaService.organization.findUnique.mockResolvedValue(null);
      mockPrismaService.organization.create.mockResolvedValue(created);

      mockAuthService.inviteUser.mockResolvedValue(true);

      const result = await service.create(dto, userfake);
      expect(result).toEqual(created);
    });

    
    it('should throw BadRequestException if creation fails', async () => {
      mockPrismaService.organization.create.mockRejectedValue(new Error());

      await expect(service.create({ name: '', cellphone: '', email: '', super_admin_email: '' }, userfake)).rejects.toThrow(BadRequestException);
    });
  });
  */

  describe('update', () => {
    it('should update and return the organization', async () => {
      const dto = { name: 'Updated Org', cellphone: '999', email: 'updated@example.com' };
      const updated = { id: '1', name: dto.name, contact_info: dto.cellphone, email: dto.email };

      mockPrismaService.organization.update.mockResolvedValue(updated);

      const result = await service.update('1', dto);
      expect(result).toEqual(updated);
    });

    it('should throw BadRequestException if update fails', async () => {
      mockPrismaService.organization.update.mockRejectedValue(new Error('fail'));

      await expect(service.update('1', { name: '', cellphone: '', email: '' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('should soft delete organization and users, returning true', async () => {
      mockPrismaService.$transaction.mockResolvedValue(true);
  
      const result = await service.delete('1');
  
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });
  
    it('should throw NotFoundException if transaction fails', async () => {
      mockPrismaService.$transaction.mockRejectedValue(new Error());
  
      await expect(service.delete('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });
  
});
