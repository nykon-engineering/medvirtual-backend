// organization.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationService } from './organization.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { HubspotService } from '../hubspot/hubspot.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OrganizationRole, OrganizationStatus } from '@prisma/client';
import { HandlerOrganizationCreation } from '../hubspot/handlers/organizationCreation';
import { HandlerDealCreation } from '../hubspot/handlers/dealCreation';
import { NotificationsService } from '../notifications/notifications.service';
import { SqsService } from '../sqs/sqs.service';
import { ContactService } from '../contacts/contacts.service';


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
  status_before_deactivation: null,
  is_organization_owner: false,
  verified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  activatedAt: new Date(),
  createdByMethod: 'self_signup',
  createdByUserId: null,
  hubspot_id: null,
  hubspot_contact_id: null,
}

describe('OrganizationService', () => {
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
    $executeRaw: jest.fn(),
    uSER: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    hireRequest: {
      updateMany: jest.fn(),
    }
  };

  const mockHubspotService = {
    createOrUpdateCompany: jest.fn(),
    createOrganizationInHubspot: jest.fn(),
    updateOrganizationInHubspot: jest.fn(),
  };

  const mockAuthService = {
    inviteUser: jest.fn(),
  };

  const handlerObjectCreationMock = {
    execute: jest.fn(),
  }

  const handlerDealCreationMock = {
    execute: jest.fn(),
  }

  const mockNotificationsService = {
    notifyHireRequestSelectWinner: jest.fn(),
  };

  const mockSqsService = {
    sendMessage: jest.fn(),
  }

  const mockContactService = {
    createForOrganization: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        { provide: AuthService, useValue: mockAuthService },
        { provide: HubspotService, useValue: mockHubspotService },
        { provide: HandlerOrganizationCreation , useValue: handlerObjectCreationMock },
        { provide: HandlerDealCreation , useValue: handlerDealCreationMock },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: SqsService, useValue: mockSqsService },
        { provide: ContactService, useValue: mockContactService },
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

  describe('getAll', () => {
    it('should return an array of organizations', async () => {
      const organizations = [
        { 
          id: '1', 
          name: 'Org 1', 
          phone: '123', 
          email: 'org1@example.com',
          status: OrganizationStatus.active,
          organization_role: OrganizationRole.prospect
        },
        { 
          id: '2', 
          name: 'Org 2', 
          phone: '567', 
          email: 'org2@example.com',
          status: OrganizationStatus.active,
          organization_role: OrganizationRole.client
        },
      ];

      mockPrismaService.organization.findMany.mockResolvedValue(organizations);

      const result = await service.getAll(userfake, 'active');
      expect(result).toEqual(organizations);
      expect(prisma.organization.findMany).toHaveBeenCalled();
    });

    it('should throw NotFoundException if an error occurs', async () => {
      mockPrismaService.organization.findMany.mockRejectedValue(new Error());

      await expect(service.getAll(userfake, 'active')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getById', () => {
    it('should return an organization by id', async () => {
      const org = { 
        id: '1', 
        name: 'Org 1', 
        phone: '123', 
        email: 'org1@example.com',
        status: OrganizationStatus.active,
        organization_role: OrganizationRole.prospect
      };

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

  describe('create', () => {
    /*
    it('should throw BadRequestException if organization already exists', async () => {
      const dto = { 
        name: 'Org 1', 
        phone: '123', 
        email: 'org1@example.com', 
        owner_email: 'admin@admin.com'
      };

      mockPrismaService.organization.findUnique.mockResolvedValue({ id: '1', name: 'Existing Org' });

      await expect(service.create(dto,userfake)).rejects.toThrow(BadRequestException);
    });
    */

    it('should throw BadRequestException if creation fails', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue(null);
      mockPrismaService.organization.create.mockRejectedValue(new Error());

      await expect(service.create({ 
        name: 'Org 1', 
        phone: '123', 
        email: 'org1@example.com', 
        owner_email: 'admin@admin.com' 
      }, userfake)).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update and return the organization', async () => {
      const dto = { name: 'Updated Org', phone: '999', email: 'updated@example.com' };
      const updated = { 
        id: '1', 
        name: dto.name, 
        phone: dto.phone, 
        email: dto.email,
        status: OrganizationStatus.active,
        organization_role: OrganizationRole.prospect
      };

      mockPrismaService.organization.update.mockResolvedValue(updated);

      const result = await service.update('1', dto);
      expect(result).toEqual(updated);
    });

    it('should throw BadRequestException if update fails', async () => {
      mockPrismaService.organization.update.mockRejectedValue(new Error('fail'));

      await expect(service.update('1', { name: '', phone: '', email: '' })).rejects.toThrow(BadRequestException);
    });

    it('should save status_before_deactivation and set users to inactive when status is inactive', async () => {
      const updated = {
        id: '1',
        name: 'Org 1',
        status: OrganizationStatus.inactive,
        organization_role: OrganizationRole.prospect,
      };

      mockPrismaService.organization.update.mockResolvedValue(updated);
      mockPrismaService.$executeRaw.mockResolvedValue(undefined);

      mockPrismaService.$transaction.mockImplementation(async (cb) => cb(mockPrismaService));

      await service.update('1', { status: 'inactive' });

      expect(mockPrismaService.$executeRaw).toHaveBeenCalledTimes(1);
      const rawStrings: ReadonlyArray<string> = mockPrismaService.$executeRaw.mock.calls[0][0];
      const rawSql = Array.from(rawStrings).join('');
      expect(rawSql).toContain('status_before_deactivation');
      expect(rawSql).toContain('inactive');
    });

    it('should restore status from status_before_deactivation when status is active', async () => {
      const updated = {
        id: '1',
        name: 'Org 1',
        status: OrganizationStatus.active,
        organization_role: OrganizationRole.prospect,
      };

      mockPrismaService.organization.update.mockResolvedValue(updated);
      mockPrismaService.$executeRaw.mockResolvedValue(undefined);

      mockPrismaService.$transaction.mockImplementation(async (cb) => cb(mockPrismaService));

      await service.update('1', { status: 'active' });

      expect(mockPrismaService.$executeRaw).toHaveBeenCalledTimes(1);
      const rawStrings: ReadonlyArray<string> = mockPrismaService.$executeRaw.mock.calls[0][0];
      const rawSql = Array.from(rawStrings).join('');
      expect(rawSql).toContain('COALESCE');
      expect(rawSql).toContain('status_before_deactivation');
    });
  });


  describe('convertToClient', () => {
    it('should convert prospect to client successfully', async () => {
      const prospectOrg = {
        id: '1',
        name: 'Prospect Org',
        organization_role: OrganizationRole.prospect,
        status: OrganizationStatus.active,
      };
  
      const clientOrg = {
        ...prospectOrg,
        organization_role: OrganizationRole.client,
        date_became_client: new Date(),
        signed_document_url: 'https://example.com/doc.pdf',
        signed_document_date: new Date(),
        owner: {},
        admin: {},
        users: [],
      };
  
      mockPrismaService.organization.findUnique
      .mockResolvedValueOnce(prospectOrg)
      .mockResolvedValueOnce(clientOrg);

      mockPrismaService.organization.update = jest.fn().mockResolvedValue(clientOrg);

      mockPrismaService.hireRequest.updateMany = jest.fn().mockResolvedValue({ count: 1 });
  
      mockPrismaService.$transaction.mockImplementation(async (cb) => {
        return cb(mockPrismaService);
      });
  
      const convertDto = {
        signed_document_url: 'https://example.com/doc.pdf',
        signed_document_date: new Date().toISOString(),
      };
  
      const result = await service.convertToClient('1', convertDto);
  
      expect(result.organization_role).toBe(OrganizationRole.client);
      expect(result.signed_document_url).toBe(convertDto.signed_document_url);
    });
  
    it('should throw BadRequestException if organization is already a client', async () => {
      const clientOrg = {
        id: '1',
        name: 'Client Org',
        organization_role: OrganizationRole.client,
        status: OrganizationStatus.active,
      };
  
      mockPrismaService.organization.findUnique.mockResolvedValue(clientOrg);
  
      const convertDto = {
        signed_document_url: 'https://example.com/doc.pdf',
      };
  
      await expect(service.convertToClient('1', convertDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  
    it('should throw NotFoundException if organization does not exist', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue(null);
  
      const convertDto = {
        signed_document_url: 'https://example.com/doc.pdf',
      };
  
      await expect(service.convertToClient('99', convertDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
  
  

  describe('assignAdmin', () => {
    it('should assign admin successfully', async () => {
      const admin = {
        id: 'admin1',
        role: 'system_admin',
        status: 'active'
      };

      const org = {
        id: '1',
        name: 'Test Org',
        admin_id: null
      };

      const updatedOrg = {
        ...org,
        admin_id: 'admin1'
      };

      mockPrismaService.uSER.findUnique.mockResolvedValue(admin);
      mockPrismaService.organization.update.mockResolvedValue(updatedOrg);

      const result = await service.assignAdmin('1', 'admin1');
      expect(result.admin_id).toBe('admin1');
    });

    it('should throw BadRequestException if admin is not a system admin', async () => {
      const user = {
        id: 'user1',
        role: 'organization_admin',
        status: 'active'
      };

      mockPrismaService.uSER.findUnique.mockResolvedValue(user);

      await expect(service.assignAdmin('1', 'user1')).rejects.toThrow(BadRequestException);
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
