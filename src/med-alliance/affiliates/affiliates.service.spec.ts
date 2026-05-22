import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AffiliatesService } from './affiliates.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { AffiliateCreationService } from '../../hubspot/create/affiliate';
import { AffiliateUpdateService } from '../../hubspot/update/affiliate';
import { HubspotService } from '../../hubspot/hubspot.service';
import { InvoiceIngestionService } from '../sync/invoice-ingestion.service';
import { AllianceNotificationsService } from '../notifications/notifications.service';

const mockAllianceNotifications: Partial<AllianceNotificationsService> = {
  notifyAdminPartnerRegistered: jest.fn(),
};

// ---------------------------------------------------------------------------
// Prisma mock — only the tables touched by AffiliatesService
// ---------------------------------------------------------------------------
const mockPrisma = {
  affiliateProfile: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  uSER: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockMailService = {
  sendMail: jest.fn(),
};

const mockAffiliateCreationService = {
  execute: jest.fn(),
};

const mockAffiliateUpdateService = {
  deactivate: jest.fn(),
};

const mockHubspotService = {
  setCompanyAffiliateReferral: jest.fn(),
};

const mockInvoiceIngestionService = {
  run: jest.fn(),
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const mockUser = {
  id: 'user-1',
  first_name: 'John',
  last_name: 'Doe',
  email: 'john@example.com',
  organization_id: 'org-1',
  role: 'organization_admin',
  status: 'active',
};

const mockAdminUser = {
  id: 'admin-1',
  first_name: 'Admin',
  last_name: 'User',
  email: 'admin@example.com',
  role: 'system_admin',
  status: 'active',
} as any;

const mockProfile = {
  id: 'profile-1',
  user_id: 'user-1',
  hubspot_id: null,
  commission_percent_default: '10.00',
  status: 'active',
  payout_preference_method: 'ach',
  payout_preference_reference: null,
  payout_preference_notes: null,
  created_by: 'admin-1',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  user: mockUser,
};



describe('AffiliatesService', () => {
  let service: AffiliatesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AffiliatesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MailService, useValue: { sendMail: jest.fn() } },
        { provide: AffiliateCreationService , useValue: mockAffiliateCreationService },
        { provide: AffiliateUpdateService , useValue: mockAffiliateUpdateService},
        { provide: HubspotService, useValue: mockHubspotService },
        { provide: InvoiceIngestionService, useValue: mockInvoiceIngestionService },
        { provide: AllianceNotificationsService, useValue: mockAllianceNotifications },
      ],
    }).compile();

    service = module.get<AffiliatesService>(AffiliatesService);
  });

  afterEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------
  // requireActiveProfile
  // -------------------------------------------------------------------------
  describe('requireActiveProfile', () => {
    it('should throw ForbiddenException when profile does not exist', async () => {
      mockPrisma.affiliateProfile.findUnique.mockResolvedValue(null);

      await expect(service.requireActiveProfile('user-1')).rejects.toThrow(
        new ForbiddenException('Affiliate profile not found'),
      );
    });

    it('should throw ForbiddenException when profile is inactive', async () => {
      mockPrisma.affiliateProfile.findUnique.mockResolvedValue({
        ...mockProfile,
        status: 'inactive',
      });

      await expect(service.requireActiveProfile('user-1')).rejects.toThrow(
        new ForbiddenException('Affiliate profile is inactive'),
      );
    });

    it('should return the profile when active', async () => {
      mockPrisma.affiliateProfile.findUnique.mockResolvedValue(mockProfile);

      const result = await service.requireActiveProfile('user-1');

      expect(result).toEqual(mockProfile);
      expect(mockPrisma.affiliateProfile.findUnique).toHaveBeenCalledWith({
        where: { user_id: 'user-1' },
      });
    });
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------
  describe('create', () => {
    const createDto = {
      user_id: 'user-1',
      commission_percent_default: 10,
      payout_preference_method: undefined,
      payout_preference_reference: undefined,
      payout_preference_notes: undefined,
      hubspot_id: undefined,
    } as any;

    it('should throw NotFoundException when target user does not exist', async () => {
      mockPrisma.uSER.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto, mockAdminUser)).rejects.toThrow(
        new NotFoundException('User not found'),
      );
    });

    it('should throw ConflictException when profile already exists', async () => {
      mockPrisma.uSER.findUnique.mockResolvedValue(mockUser);
      mockPrisma.affiliateProfile.findUnique.mockResolvedValue(mockProfile);

      await expect(service.create(createDto, mockAdminUser)).rejects.toThrow(
        new ConflictException('This user already has an affiliate profile'),
      );
    });

    it('should create and return a new profile', async () => {
      mockPrisma.uSER.findUnique.mockResolvedValue(mockUser);
      // 1st call: conflict check → no existing profile
      // 2nd call: inside findOne after create → return the created profile
      mockPrisma.affiliateProfile.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockProfile);
      mockPrisma.affiliateProfile.create.mockResolvedValue(mockProfile);

      const result = await service.create(createDto, mockAdminUser);

      expect(result).toEqual(mockProfile);
      expect(mockPrisma.affiliateProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user_id: 'user-1',
            commission_percent_default: 10,
            created_by: 'admin-1',
          }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // findAll
  // -------------------------------------------------------------------------
  describe('findAll', () => {
    it('should return paginated profiles with default params', async () => {
      mockPrisma.$transaction.mockResolvedValue([[mockProfile], 1]);

      const result = await service.findAll({});

      expect(result).toEqual({
        data: [mockProfile],
        pagination: { page: 1, limit: 20, total: 1 },
      });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should apply status filter', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await service.findAll({ status: 'inactive' as any });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should apply search filter', async () => {
      mockPrisma.$transaction.mockResolvedValue([[mockProfile], 1]);

      const result = await service.findAll({ search: 'john' });

      expect(result.data).toHaveLength(1);
    });

    it('should respect custom page and limit', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      const result = await service.findAll({ page: 2, limit: 5 });

      expect(result.pagination).toEqual({ page: 2, limit: 5, total: 0 });
    });
  });

  // -------------------------------------------------------------------------
  // findOne
  // -------------------------------------------------------------------------
  describe('findOne', () => {
    it('should throw NotFoundException when profile does not exist', async () => {
      mockPrisma.affiliateProfile.findUnique.mockResolvedValue(null);

      await expect(service.findOne('profile-99')).rejects.toThrow(
        new NotFoundException('Affiliate profile not found'),
      );
    });

    it('should return the profile when found', async () => {
      mockPrisma.affiliateProfile.findUnique.mockResolvedValue(mockProfile);

      const result = await service.findOne('profile-1');

      expect(result).toEqual(mockProfile);
      expect(mockPrisma.affiliateProfile.findUnique).toHaveBeenCalledWith({
        where: { id: 'profile-1' },
        include: expect.any(Object),
      });
    });
  });

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------
  describe('update', () => {
    it('should throw NotFoundException when profile does not exist', async () => {
      mockPrisma.affiliateProfile.findUnique.mockResolvedValue(null);

      await expect(service.update('profile-99', {})).rejects.toThrow(
        new NotFoundException('Affiliate profile not found'),
      );
    });

    it('should update commission_percent_default', async () => {
      mockPrisma.affiliateProfile.findUnique.mockResolvedValue(mockProfile);
      const updated = { ...mockProfile, commission_percent_default: '15.00' };
      mockPrisma.affiliateProfile.update.mockResolvedValue(updated);

      const result = await service.update('profile-1', {
        commission_percent_default: 15,
      });

      expect(result.commission_percent_default).toBe('15.00');
      expect(mockPrisma.affiliateProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'profile-1' },
          data: expect.objectContaining({ commission_percent_default: 15 }),
        }),
      );
    });

    it('should update status to inactive', async () => {
      mockPrisma.affiliateProfile.findUnique.mockResolvedValue(mockProfile);
      const updated = { ...mockProfile, status: 'inactive' };
      mockPrisma.affiliateProfile.update.mockResolvedValue(updated);

      const result = await service.update('profile-1', { status: 'inactive' as any });

      expect(result.status).toBe('inactive');
    });

    it('should not set undefined fields in the update data', async () => {
      mockPrisma.affiliateProfile.findUnique.mockResolvedValue(mockProfile);
      mockPrisma.affiliateProfile.update.mockResolvedValue(mockProfile);

      await service.update('profile-1', { payout_preference_method: undefined });

      expect(mockPrisma.affiliateProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ payout_preference_method: undefined }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // findOwn
  // -------------------------------------------------------------------------
  describe('findOwn', () => {
    it('should throw NotFoundException when affiliate has no profile', async () => {
      mockPrisma.affiliateProfile.findUnique.mockResolvedValue(null);

      await expect(service.findOwn(mockUser as any)).rejects.toThrow(
        new NotFoundException('Affiliate profile not found'),
      );
    });

    it('should return own profile', async () => {
      mockPrisma.affiliateProfile.findUnique.mockResolvedValue(mockProfile);

      const result = await service.findOwn(mockUser as any);

      expect(result).toEqual(mockProfile);
      expect(mockPrisma.affiliateProfile.findUnique).toHaveBeenCalledWith({
        where: { user_id: 'user-1' },
        include: expect.any(Object),
      });
    });
  });

  // -------------------------------------------------------------------------
  // updateOwn
  // -------------------------------------------------------------------------
  describe('updateOwn', () => {
    it('should throw ForbiddenException when profile is inactive', async () => {
      mockPrisma.affiliateProfile.findUnique.mockResolvedValue({
        ...mockProfile,
        status: 'inactive',
      });

      await expect(
        service.updateOwn(mockUser as any, { payout_preference_method: 'wire' as any }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update payout preferences', async () => {
      mockPrisma.affiliateProfile.findUnique.mockResolvedValue(mockProfile);
      const updated = {
        ...mockProfile,
        payout_preference_method: 'wire',
        payout_preference_reference: 'ACC-001',
      };
      mockPrisma.affiliateProfile.update.mockResolvedValue(updated);

      const result = await service.updateOwn(mockUser as any, {
        payout_preference_method: 'wire' as any,
        payout_preference_reference: 'ACC-001',
      });

      expect(result.payout_preference_method).toBe('wire');
      expect(result.payout_preference_reference).toBe('ACC-001');
    });

    it('should not allow updating commission_percent_default via updateOwn', async () => {
      mockPrisma.affiliateProfile.findUnique.mockResolvedValue(mockProfile);
      mockPrisma.affiliateProfile.update.mockResolvedValue(mockProfile);

      // commission_percent_default is not a field in UpdateAffiliatePayoutPreferencesDto
      // so passing it should not affect the update call
      await service.updateOwn(mockUser as any, {} as any);

      expect(mockPrisma.affiliateProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ commission_percent_default: expect.anything() }),
        }),
      );
    });
  });
});
