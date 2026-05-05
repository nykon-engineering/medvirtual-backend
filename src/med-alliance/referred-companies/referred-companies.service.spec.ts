import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReferredCompaniesService } from './referred-companies.service';
import { EligibilityCheckService } from './eligibility-check.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AffiliatesService } from '../affiliates/affiliates.service';
import { ReferralSyncService } from '../sync/referral-sync.service';
import { ReviewCasesService } from '../review-cases/review-cases.service';
import { OrganizationService } from '../../organization/organization.service';
import { HubspotService } from '../../hubspot/hubspot.service';
import { ContactService } from '../../contacts/contacts.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockPrisma = {
  organization: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  affiliateCommission: {
    deleteMany: jest.fn(),
  },
  hubspotInvoiceSnapshot: {
    deleteMany: jest.fn(),
  },
  medAllianceAdminReviewCase: {
    deleteMany: jest.fn(),
  },
  medAllianceAuditLog: {
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  uSER: {
    findMany: jest.fn(),
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

const mockReviewCasesService = {
  openOrSkip: jest.fn(),
};

const mockOrganizationService = {
  create: jest.fn(),
  getById: jest.fn(),
}

const mockHubspotService = {
  createOrganizationInHubspot: jest.fn(),
  createContactFromReferredCompanyInHubspot: jest.fn(),
  deleteCompanyInHubspot: jest.fn(),
  deleteContactInHubspot: jest.fn(),
};

const mockContactService = {
  createForOrganization: jest.fn(),
  createForReferredCompany: jest.fn().mockResolvedValue({ contact: null, hubspotId: null }),
  deleteById: jest.fn(),
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
  commission_status: 'none',
  my_commissions: 0,
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
        { provide: ReviewCasesService, useValue: mockReviewCasesService },
        { provide: OrganizationService, useValue: mockOrganizationService},
        { provide: HubspotService, useValue: mockHubspotService },
        { provide: ContactService, useValue: mockContactService },
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
      contact_first_name: 'John',
      contact_last_name: 'Doe',
      contact_email: 'contato@org1.com',
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
      expect(mockOrganizationService.create).not.toHaveBeenCalled();
      expect(mockEligibilityCheckService.runAndPersist).not.toHaveBeenCalled();
    });

    it('should create org, run eligibility check, and return updated record', async () => {
      mockAffiliatesService.requireActiveProfile.mockResolvedValue({ id: 'profile-1', status: 'active' });
      mockOrganizationService.create.mockResolvedValue(mockOrg);
      mockOrganizationService.getById.mockResolvedValue(mockOrgWithEligibility);
      mockEligibilityCheckService.runAndPersist.mockResolvedValue(undefined);
      mockPrisma.organization.findFirst.mockResolvedValue(null); // no soft duplicate
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrgWithEligibility);

      const result = await service.create(createDto, mockCurrentUser);

      // org created via OrganizationService with correct args
      expect(mockOrganizationService.create).toHaveBeenCalledWith(
        createDto,
        mockCurrentUser,
        mockCurrentUser.id,
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

    it('should return org with not_eligible when check blocks the referral', async () => {
      const blockedOrg = {
        ...mockOrg,
        med_alliance_referral_status: 'not_eligible',
        med_alliance_block_reason: 'active_client_block: organization_active_by_email',
      };

      mockAffiliatesService.requireActiveProfile.mockResolvedValue({ id: 'profile-1', status: 'active' });
      mockOrganizationService.create.mockResolvedValue(mockOrg);
      mockOrganizationService.getById.mockResolvedValue(blockedOrg);
      mockEligibilityCheckService.runAndPersist.mockResolvedValue(undefined);
      mockPrisma.organization.findFirst.mockResolvedValue(null); // no soft duplicate
      mockPrisma.organization.findUnique.mockResolvedValue(blockedOrg);

      const result = await service.create(createDto, mockCurrentUser);

      expect(result!.med_alliance_referral_status).toBe('not_eligible');
      expect(result!.med_alliance_block_reason).toBe(
        'active_client_block: organization_active_by_email',
      );
    });

    it('should create organization with only required fields when optionals are omitted', async () => {
      const orgNoEmail = { ...mockOrgWithEligibility, email: null };
      mockAffiliatesService.requireActiveProfile.mockResolvedValue({ id: 'profile-1', status: 'active' });
      mockOrganizationService.create.mockResolvedValue({ ...mockOrg, email: null });
      mockOrganizationService.getById.mockResolvedValue(orgNoEmail);
      mockEligibilityCheckService.runAndPersist.mockResolvedValue(undefined);
      mockPrisma.organization.findFirst.mockResolvedValue(null); // no soft duplicate
      mockPrisma.organization.findUnique.mockResolvedValue(orgNoEmail);

      const result = await service.create(
        {
          name: 'MinOrg',
          email: 'minorg@example.com',
          website_url: 'https://minorg.com',
          contact_first_name: 'John',
          contact_last_name: 'Doe',
          contact_email: 'contato@org1.com' 
        },
        mockCurrentUser,
      );

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

    it('should NOT return sensitive fields (hubspot_id, owner, admin, users, staff) for affiliate list', async () => {
      const scopedListOrg = {
        id: mockOrg.id,
        name: mockOrg.name,
        email: mockOrg.email,
        phone: mockOrg.phone,
        status: mockOrg.status,
        industry: mockOrg.industry,
        location: mockOrg.location,
        address: undefined,
        city: undefined,
        state: undefined,
        description: mockOrg.description,
        website_url: mockOrg.website_url,
        createdAt: mockOrg.createdAt,
        contact_first_name: undefined,
        contact_last_name: undefined,
        med_alliance_referral_status: undefined,
      };
      mockPrisma.$transaction.mockResolvedValue([[scopedListOrg], 1]);

      const result = await service.findAllForAffiliate({}, mockCurrentUser);

      const org = result.data[0];
      expect(org).not.toHaveProperty('hubspot_id');
      expect(org).not.toHaveProperty('owner');
      expect(org).not.toHaveProperty('admin');
      expect(org).not.toHaveProperty('users');
      expect(org).not.toHaveProperty('staff');
      expect(org).not.toHaveProperty('hubspot_sync_status');
      expect(org).not.toHaveProperty('hubspot_sync_error');
    });
  });

  // -------------------------------------------------------------------------
  // findOneForAffiliate
  // -------------------------------------------------------------------------
  describe('findOneForAffiliate', () => {
    // Scoped fixture — only the fields returned by the select allowlist
    const scopedOrg = {
      id: mockOrg.id,
      name: mockOrg.name,
      email: mockOrg.email,
      phone: mockOrg.phone,
      status: mockOrg.status,
      industry: mockOrg.industry,
      location: mockOrg.location,
      address: undefined,
      city: undefined,
      state: undefined,
      description: mockOrg.description,
      website_url: mockOrg.website_url,
      createdAt: mockOrg.createdAt,
      contact_first_name: undefined,
      contact_last_name: undefined,
      med_alliance_referral_status: undefined,
    };

    it('should throw NotFoundException when organization does not exist', async () => {
      // First call (ownership check) returns null
      mockPrisma.organization.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.findOneForAffiliate('org-99', mockCurrentUser),
      ).rejects.toThrow(new NotFoundException('Referred company not found'));
    });

    it('should throw ForbiddenException when org was referred by a different affiliate', async () => {
      // First call returns ownership check with different affiliate
      mockPrisma.organization.findUnique.mockResolvedValueOnce({
        id: 'org-1',
        referred_by_affiliate_id: 'other-user',
      });

      await expect(
        service.findOneForAffiliate('org-1', mockCurrentUser),
      ).rejects.toThrow(
        new ForbiddenException('You do not have access to this referred company'),
      );
    });

    it('should return the scoped organization when it belongs to the current affiliate', async () => {
      // First call: ownership check
      mockPrisma.organization.findUnique.mockResolvedValueOnce({
        id: 'org-1',
        referred_by_affiliate_id: 'user-1',
      });
      // Second call: scoped select
      mockPrisma.organization.findUnique.mockResolvedValueOnce(scopedOrg);

      const result = await service.findOneForAffiliate('org-1', mockCurrentUser);

      expect(result).toEqual(scopedOrg);
    });

    it('should NOT return hubspot_id, owner, admin, users, or staff for affiliate', async () => {
      mockPrisma.organization.findUnique.mockResolvedValueOnce({
        id: 'org-1',
        referred_by_affiliate_id: 'user-1',
      });
      mockPrisma.organization.findUnique.mockResolvedValueOnce(scopedOrg);

      const result = await service.findOneForAffiliate('org-1', mockCurrentUser);

      expect(result).not.toHaveProperty('hubspot_id');
      expect(result).not.toHaveProperty('owner');
      expect(result).not.toHaveProperty('admin');
      expect(result).not.toHaveProperty('users');
      expect(result).not.toHaveProperty('staff');
      expect(result).not.toHaveProperty('hubspot_sync_status');
      expect(result).not.toHaveProperty('hubspot_sync_error');
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

    it('should filter by referral_stage when provided', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      const result = await service.findAllForAdmin({ referral_stage: 'deployed' as any });

      expect(result.data).toHaveLength(0);
    });

    it('should filter by med_alliance_referral_status when provided', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      const result = await service.findAllForAdmin({ med_alliance_referral_status: 'eligible' as any });

      expect(result.data).toHaveLength(0);
    });

    it('should filter by affiliate_user_id when provided', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      const result = await service.findAllForAdmin({ affiliate_user_id: 'user-99' });

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

    it('should return full payload including owner, admin, users for admin (no regression)', async () => {
      const fullOrg = {
        ...mockOrg,
        owner: { id: 'owner-1', email: 'owner@acme.com' },
        admin: { id: 'admin-1', email: 'admin@acme.com' },
        users: [{ id: 'u1', email: 'u1@acme.com' }],
        referredByAffiliate: { id: 'user-1', first_name: 'Jane', last_name: 'Affiliate', email: 'jane@example.com' },
      };
      mockPrisma.organization.findUnique.mockResolvedValue(fullOrg);

      const result = await service.findOneForAdmin('org-1');

      // Admin SHOULD see all internal fields
      expect(result).toHaveProperty('owner');
      expect(result).toHaveProperty('admin');
      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('referredByAffiliate');
    });
  });

  // -------------------------------------------------------------------------
  // computeEffectiveStatus — 30-day gate (tested via findOneForAffiliate)
  // -------------------------------------------------------------------------
  describe('computeEffectiveStatus — 30-day gate', () => {
    const makeOrgWithStatus = (
      stored: string,
      eligibilityStartAt: Date | null,
    ) => ({
      id: 'org-1',
      name: 'Acme Corp',
      referred_by_affiliate_id: 'user-1',
      med_alliance_referral_status: stored,
      eligibility_start_at: eligibilityStartAt,
      affiliateCommissions: [],
    });

    beforeEach(() => {
      mockPrisma.organization.findUnique.mockResolvedValueOnce({
        id: 'org-1',
        referred_by_affiliate_id: 'user-1',
      });
    });

    it('should return "not_eligible" when stored=eligible but deployed < 30 days ago', async () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      mockPrisma.organization.findUnique.mockResolvedValueOnce(
        makeOrgWithStatus('eligible', tenDaysAgo),
      );

      const result = await service.findOneForAffiliate('org-1', mockCurrentUser);

      expect((result as any).med_alliance_referral_status).toBe('not_eligible');
    });

    it('should return "eligible" when stored=eligible and deployed > 30 days and < 1 year ago', async () => {
      const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      mockPrisma.organization.findUnique.mockResolvedValueOnce(
        makeOrgWithStatus('eligible', fortyDaysAgo),
      );

      const result = await service.findOneForAffiliate('org-1', mockCurrentUser);

      expect((result as any).med_alliance_referral_status).toBe('eligible');
    });

    it('should return "not_eligible" when stored=eligible but deployed > 1 year ago', async () => {
      const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);
      mockPrisma.organization.findUnique.mockResolvedValueOnce(
        makeOrgWithStatus('eligible', twoYearsAgo),
      );

      const result = await service.findOneForAffiliate('org-1', mockCurrentUser);

      expect((result as any).med_alliance_referral_status).toBe('not_eligible');
    });

    it('should return "not_eligible" when stored=eligible but eligibility_start_at is null', async () => {
      mockPrisma.organization.findUnique.mockResolvedValueOnce(
        makeOrgWithStatus('eligible', null),
      );

      const result = await service.findOneForAffiliate('org-1', mockCurrentUser);

      expect((result as any).med_alliance_referral_status).toBe('not_eligible');
    });

    it('should pass through "not_eligible" unchanged', async () => {
      const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      mockPrisma.organization.findUnique.mockResolvedValueOnce(
        makeOrgWithStatus('not_eligible', fortyDaysAgo),
      );

      const result = await service.findOneForAffiliate('org-1', mockCurrentUser);

      expect((result as any).med_alliance_referral_status).toBe('not_eligible');
    });
  });

  // -------------------------------------------------------------------------
  // updateReferralStage
  // -------------------------------------------------------------------------
  describe('updateReferralStage', () => {
    const mockAdminUser = {
      id: 'admin-1',
      first_name: 'Admin',
      last_name: 'User',
      role: 'system_admin',
    } as any;

    const makeFullOrg = (overrides: Partial<any> = {}) => ({
      ...mockOrg,
      referral_stage: 'referred',
      eligibility_start_at: null,
      med_alliance_block_reason: null,
      hubspot_id: null,
      hubspot_sync_status: null,
      hubspot_sync_error: null,
      hubspot_synced_at: null,
      first_paid_invoice_at: null,
      referredByAffiliate: null,
      referToUser: null,
      users: [],
      affiliateCommissions: [],
      hubspotInvoiceSnapshots: [],
      adminReviewCases: [],
      ...overrides,
    });

    it('should throw NotFoundException when org does not exist', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.updateReferralStage('org-99', { stage: 'contacted' as any }, mockAdminUser),
      ).rejects.toThrow(new NotFoundException('Referred company not found'));
    });

    it('should throw BadRequestException when org is not a referred company', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-1',
        referral_stage: 'referred',
        eligibility_start_at: null,
        referred_by_affiliate_id: null, // not a referral
      });

      await expect(
        service.updateReferralStage('org-1', { stage: 'contacted' as any }, mockAdminUser),
      ).rejects.toThrow(new BadRequestException('Not a referred company'));
    });

    it('should update referral_stage and write audit log', async () => {
      mockPrisma.organization.findUnique
        .mockResolvedValueOnce({
          id: 'org-1',
          referral_stage: 'referred',
          eligibility_start_at: null,
          referred_by_affiliate_id: 'user-1',
        })
        .mockResolvedValueOnce(makeFullOrg({ referral_stage: 'contacted' }));
      mockPrisma.organization.update.mockResolvedValue({});
      mockPrisma.medAllianceAuditLog.create.mockResolvedValue({});

      const result = await service.updateReferralStage(
        'org-1',
        { stage: 'contacted' as any },
        mockAdminUser,
      );

      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'org-1' },
          data: expect.objectContaining({ referral_stage: 'contacted' }),
        }),
      );
      expect(mockPrisma.medAllianceAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event: 'stage_changed',
            old_status: 'referred',
            new_status: 'contacted',
            source: 'admin_action',
            actor_user_id: 'admin-1',
          }),
        }),
      );
      expect((result as any).referral_stage).toBe('contacted');
    });

    it('should set eligibility_start_at when moving to "deployed" with no prior start', async () => {
      mockPrisma.organization.findUnique
        .mockResolvedValueOnce({
          id: 'org-1',
          referral_stage: 'contract_signed',
          eligibility_start_at: null, // no clock started yet
          referred_by_affiliate_id: 'user-1',
        })
        .mockResolvedValueOnce(makeFullOrg({ referral_stage: 'deployed' }));
      mockPrisma.organization.update.mockResolvedValue({});
      mockPrisma.medAllianceAuditLog.create.mockResolvedValue({});

      await service.updateReferralStage(
        'org-1',
        { stage: 'deployed' as any },
        mockAdminUser,
      );

      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            referral_stage: 'deployed',
            eligibility_start_at: expect.any(Date),
          }),
        }),
      );
    });

    it('should NOT overwrite eligibility_start_at when already set on move to "deployed"', async () => {
      const existingStart = new Date('2026-03-01');
      mockPrisma.organization.findUnique
        .mockResolvedValueOnce({
          id: 'org-1',
          referral_stage: 'contract_signed',
          eligibility_start_at: existingStart, // already running
          referred_by_affiliate_id: 'user-1',
        })
        .mockResolvedValueOnce(makeFullOrg({ referral_stage: 'deployed' }));
      mockPrisma.organization.update.mockResolvedValue({});
      mockPrisma.medAllianceAuditLog.create.mockResolvedValue({});

      await service.updateReferralStage(
        'org-1',
        { stage: 'deployed' as any },
        mockAdminUser,
      );

      const updateData = mockPrisma.organization.update.mock.calls[0][0].data;
      // eligibility_start_at must NOT be set in the update payload
      expect(updateData).not.toHaveProperty('eligibility_start_at');
    });

    it('should include optional reason in the audit log', async () => {
      mockPrisma.organization.findUnique
        .mockResolvedValueOnce({
          id: 'org-1',
          referral_stage: 'referred',
          eligibility_start_at: null,
          referred_by_affiliate_id: 'user-1',
        })
        .mockResolvedValueOnce(makeFullOrg({ referral_stage: 'contacted' }));
      mockPrisma.organization.update.mockResolvedValue({});
      mockPrisma.medAllianceAuditLog.create.mockResolvedValue({});

      await service.updateReferralStage(
        'org-1',
        { stage: 'contacted' as any, reason: 'Reached out via email' },
        mockAdminUser,
      );

      expect(mockPrisma.medAllianceAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ reason: 'Reached out via email' }),
        }),
      );
    });
  });
});
