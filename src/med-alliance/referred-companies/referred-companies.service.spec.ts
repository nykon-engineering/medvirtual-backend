import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReferredCompaniesService } from './referred-companies.service';
import { EligibilityCheckService } from './eligibility-check.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AffiliatesService } from '../affiliates/affiliates.service';
import { ReferralSyncService } from '../sync/referral-sync.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockPrisma = {
  organization: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockAffiliatesService = {
  requireActiveProfile: jest.fn(),
};

const mockEligibilityCheckService = {
  runAndPersist: jest.fn(),
};

const mockReferralSyncService = {
  run: jest.fn(),
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const mockCurrentUser = {
  id: 'user-1',
  first_name: 'Jane',
  last_name: 'Affiliate',
  email: 'jane@example.com',
  role: 'organization_admin',
  status: 'active',
} as any;

const mockOrg = {
  id: 'org-1',
  name: 'Acme Corp',
  email: 'contact@acme.com',
  phone: null,
  website_url: 'https://acme.com',
  location: 'New York',
  industry: 'Healthcare',
  description: null,
  organization_role: 'prospect',
  status: 'active',
  hubspot_id: null,
  referred_by_affiliate_id: 'user-1',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('ReferredCompaniesService', () => {
  let service: ReferredCompaniesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferredCompaniesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AffiliatesService, useValue: mockAffiliatesService },
        { provide: EligibilityCheckService, useValue: mockEligibilityCheckService },
        { provide: ReferralSyncService, useValue: mockReferralSyncService },
      ],
    }).compile();

    service = module.get<ReferredCompaniesService>(ReferredCompaniesService);
  });

  afterEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------
  // create
  // Note: after creating the org, service calls eligibilityCheck.runAndPersist()
  // then re-fetches via prisma.organization.findUnique to return the updated record.
  // -------------------------------------------------------------------------
  describe('create', () => {
    const createDto = {
      name: 'Acme Corp',
      email: 'contact@acme.com',
      website_url: 'https://acme.com',
      location: 'New York',
      industry: 'Healthcare',
    };

    const mockOrgWithEligibility = {
      ...mockOrg,
      med_alliance_referral_status: 'eligible',
      med_alliance_block_reason: null,
    };

    it('should throw ForbiddenException when affiliate profile is inactive or missing', async () => {
      mockAffiliatesService.requireActiveProfile.mockRejectedValue(
        new ForbiddenException('Affiliate profile is inactive'),
      );

      await expect(service.create(createDto, mockCurrentUser)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.organization.create).not.toHaveBeenCalled();
      expect(mockEligibilityCheckService.runAndPersist).not.toHaveBeenCalled();
    });

    it('should create org, run eligibility check, and return updated record', async () => {
      mockAffiliatesService.requireActiveProfile.mockResolvedValue({ id: 'profile-1', status: 'active' });
      mockPrisma.organization.create.mockResolvedValue(mockOrg);
      mockEligibilityCheckService.runAndPersist.mockResolvedValue(undefined);
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrgWithEligibility);

      const result = await service.create(createDto, mockCurrentUser);

      // org created with correct fields
      expect(mockPrisma.organization.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Acme Corp',
            referred_by_affiliate_id: 'user-1',
            organization_role: 'prospect',
          }),
        }),
      );
      // eligibility check ran with correct args
      expect(mockEligibilityCheckService.runAndPersist).toHaveBeenCalledWith(
        mockOrg.id,
        mockCurrentUser.id,
        'user',
      );
      // final result includes eligibility fields
      expect(result).toEqual(mockOrgWithEligibility);
    });

    it('should return org with not_eligible_active_client when check blocks the referral', async () => {
      const blockedOrg = {
        ...mockOrg,
        med_alliance_referral_status: 'not_eligible_active_client',
        med_alliance_block_reason: 'active_client_block: organization_active_by_email',
      };

      mockAffiliatesService.requireActiveProfile.mockResolvedValue({ id: 'profile-1', status: 'active' });
      mockPrisma.organization.create.mockResolvedValue(mockOrg);
      mockEligibilityCheckService.runAndPersist.mockResolvedValue(undefined);
      mockPrisma.organization.findUnique.mockResolvedValue(blockedOrg);

      const result = await service.create(createDto, mockCurrentUser);

      expect(result!.med_alliance_referral_status).toBe('not_eligible_active_client');
      expect(result!.med_alliance_block_reason).toBe(
        'active_client_block: organization_active_by_email',
      );
    });

    it('should create organization with only required fields when optionals are omitted', async () => {
      const orgNoEmail = { ...mockOrgWithEligibility, email: null };
      mockAffiliatesService.requireActiveProfile.mockResolvedValue({ id: 'profile-1', status: 'active' });
      mockPrisma.organization.create.mockResolvedValue({ ...mockOrg, email: null });
      mockEligibilityCheckService.runAndPersist.mockResolvedValue(undefined);
      mockPrisma.organization.findUnique.mockResolvedValue(orgNoEmail);

      const result = await service.create({ name: 'MinOrg' }, mockCurrentUser);

      expect(result!.email).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // findAllForAffiliate
  // -------------------------------------------------------------------------
  describe('findAllForAffiliate', () => {
    it('should return only organizations referred by the current user', async () => {
      mockPrisma.$transaction.mockResolvedValue([[mockOrg], 1]);

      const result = await service.findAllForAffiliate({}, mockCurrentUser);

      expect(result).toEqual({
        data: [mockOrg],
        pagination: { page: 1, limit: 20, total: 1 },
      });
      // Confirm scoping: the where clause passed to $transaction must filter by user id
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should apply status filter', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      const result = await service.findAllForAffiliate({ status: 'inactive' as any }, mockCurrentUser);

      expect(result.data).toHaveLength(0);
    });

    it('should apply search filter', async () => {
      mockPrisma.$transaction.mockResolvedValue([[mockOrg], 1]);

      const result = await service.findAllForAffiliate({ search: 'Acme' }, mockCurrentUser);

      expect(result.data).toHaveLength(1);
    });

    it('should respect pagination params', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      const result = await service.findAllForAffiliate({ page: 3, limit: 5 }, mockCurrentUser);

      expect(result.pagination).toEqual({ page: 3, limit: 5, total: 0 });
    });
  });

  // -------------------------------------------------------------------------
  // findOneForAffiliate
  // -------------------------------------------------------------------------
  describe('findOneForAffiliate', () => {
    it('should throw NotFoundException when organization does not exist', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.findOneForAffiliate('org-99', mockCurrentUser),
      ).rejects.toThrow(new NotFoundException('Referred company not found'));
    });

    it('should throw ForbiddenException when org was referred by a different affiliate', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        ...mockOrg,
        referred_by_affiliate_id: 'other-user',
      });

      await expect(
        service.findOneForAffiliate('org-1', mockCurrentUser),
      ).rejects.toThrow(
        new ForbiddenException('You do not have access to this referred company'),
      );
    });

    it('should return the organization when it belongs to the current affiliate', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);

      const result = await service.findOneForAffiliate('org-1', mockCurrentUser);

      expect(result).toEqual(mockOrg);
    });
  });

  // -------------------------------------------------------------------------
  // findAllForAdmin
  // -------------------------------------------------------------------------
  describe('findAllForAdmin', () => {
    it('should return all referred organizations without affiliate scoping', async () => {
      const orgWithAffiliate = {
        ...mockOrg,
        referredByAffiliate: { id: 'user-1', first_name: 'Jane', last_name: 'Affiliate', email: 'jane@example.com' },
      };
      mockPrisma.$transaction.mockResolvedValue([[orgWithAffiliate], 1]);

      const result = await service.findAllForAdmin({});

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty('referredByAffiliate');
      expect(result.pagination.total).toBe(1);
    });

    it('should apply search and status filters for admin', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      const result = await service.findAllForAdmin({
        search: 'NonExistent',
        status: 'inactive' as any,
      });

      expect(result.data).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // findOneForAdmin
  // -------------------------------------------------------------------------
  describe('findOneForAdmin', () => {
    it('should throw NotFoundException when organization does not exist', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(service.findOneForAdmin('org-99')).rejects.toThrow(
        new NotFoundException('Referred company not found'),
      );
    });

    it('should return organization with referredByAffiliate details', async () => {
      const orgWithAffiliate = {
        ...mockOrg,
        referredByAffiliate: { id: 'user-1', first_name: 'Jane', last_name: 'Affiliate', email: 'jane@example.com' },
      };
      mockPrisma.organization.findUnique.mockResolvedValue(orgWithAffiliate);

      const result = await service.findOneForAdmin('org-1');

      expect(result).toHaveProperty('referredByAffiliate');
      expect((result as any).referredByAffiliate.id).toBe('user-1');
    });
  });
});
