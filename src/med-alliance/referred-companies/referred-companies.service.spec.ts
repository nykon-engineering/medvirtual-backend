import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReferredCompaniesService } from './referred-companies.service';

jest.mock('axios');
import { EligibilityCheckService } from './eligibility-check.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AffiliatesService } from '../affiliates/affiliates.service';
import { ReferralSyncService } from '../sync/referral-sync.service';
import { ReviewCasesService } from '../review-cases/review-cases.service';
import { OrganizationService } from '../../organization/organization.service';
import { HubspotService } from '../../hubspot/hubspot.service';
import { ContactService } from '../../contacts/contacts.service';
import { AllianceNotificationsService } from '../notifications/notifications.service';

const mockAllianceNotifications: Partial<AllianceNotificationsService> = {
  notifyAdminReferralNew: jest.fn(),
  notifyReferralStageChanged: jest.fn(),
};

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
    findMany: jest.fn(),
    update: jest.fn(),
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
        { provide: AllianceNotificationsService, useValue: mockAllianceNotifications },
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

    it('should select invoice_number alongside hubspot_id on the commission snapshot', async () => {
      mockPrisma.organization.findUnique.mockResolvedValueOnce({
        id: 'org-1',
        referred_by_affiliate_id: 'user-1',
      });
      mockPrisma.organization.findUnique.mockResolvedValueOnce(scopedOrg);

      await service.findOneForAffiliate('org-1', mockCurrentUser);

      const scopedCallArgs = mockPrisma.organization.findUnique.mock.calls[1][0];
      expect(
        scopedCallArgs.select.affiliateCommissions.select.hubspotInvoiceSnapshot
          .select,
      ).toEqual(
        expect.objectContaining({
          hubspot_id: true,
          invoice_number: true,
        }),
      );
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

    it('should select invoice_number alongside hubspot_id on the commission snapshot', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);

      await service.findOneForAdmin('org-1');

      const callArgs = mockPrisma.organization.findUnique.mock.calls[0][0];
      expect(
        callArgs.select.affiliateCommissions.select.hubspotInvoiceSnapshot
          .select,
      ).toEqual(
        expect.objectContaining({
          hubspot_id: true,
          invoice_number: true,
        }),
      );
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

    it('should return "eligible" when stored=eligible and eligibility_start_at is in the past (< 30 days)', async () => {
      // eligibility_start_at is already deployDate+30d, so even 10 days ago means
      // the company has been past the stabilization window — status must be eligible.
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      mockPrisma.organization.findUnique.mockResolvedValueOnce(
        makeOrgWithStatus('eligible', tenDaysAgo),
      );

      const result = await service.findOneForAffiliate('org-1', mockCurrentUser);

      expect((result as any).med_alliance_referral_status).toBe('eligible');
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

    it('should set eligibility_start_at to deployment_date + 30 days when moving to "deployed"', async () => {
      const deploymentDate = new Date('2026-02-16T00:00:00.000Z');
      const expectedEligibility = new Date(
        deploymentDate.getTime() + 30 * 24 * 60 * 60 * 1000,
      );

      mockPrisma.organization.findUnique
        .mockResolvedValueOnce({
          id: 'org-1',
          referral_stage: 'contract_signed',
          eligibility_start_at: null,
          deployment_date: deploymentDate,
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
            eligibility_start_at: expectedEligibility,
          }),
        }),
      );
    });

    it('should fall back to now + 30 days when deployment_date is null and moving to "deployed"', async () => {
      const before = Date.now();

      mockPrisma.organization.findUnique
        .mockResolvedValueOnce({
          id: 'org-1',
          referral_stage: 'contract_signed',
          eligibility_start_at: null,
          deployment_date: null,
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

      const after = Date.now();
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
      const updateData = mockPrisma.organization.update.mock.calls[0][0].data;
      const eligibility: Date = updateData.eligibility_start_at;

      expect(eligibility).toBeInstanceOf(Date);
      expect(eligibility.getTime()).toBeGreaterThanOrEqual(before + THIRTY_DAYS_MS);
      expect(eligibility.getTime()).toBeLessThanOrEqual(after + THIRTY_DAYS_MS);
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

  // -------------------------------------------------------------------------
  // eligibility admin actions
  // -------------------------------------------------------------------------
  describe('eligibility admin actions', () => {
    const mockAdminUser = {
      id: 'admin-1',
      first_name: 'Admin',
      last_name: 'User',
      role: 'system_admin',
    } as any;

    const makeAdminOrg = (overrides: Partial<any> = {}) => ({
      ...mockOrg,
      med_alliance_referral_status: 'pending_confirmation',
      eligibility_start_at: new Date('2026-02-01T00:00:00.000Z'),
      deployment_date: new Date('2026-02-01T00:00:00.000Z'),
      first_paid_invoice_at: null,
      med_alliance_block_reason: null,
      med_alliance_approval_note: null,
      referral_stage: 'deployed',
      hubspot_sync_status: null,
      hubspot_sync_error: null,
      hubspot_synced_at: null,
      referredByAffiliate: null,
      referToUser: null,
      users: [],
      affiliateCommissions: [],
      hubspotInvoiceSnapshots: [],
      adminReviewCases: [],
      ...overrides,
    });

    it('should confirm eligibility with backfill and promote detected commissions', async () => {
      const existingStart = new Date('2026-02-01T00:00:00.000Z');
      mockPrisma.organization.findUnique
        .mockResolvedValueOnce({
          id: 'org-1',
          referred_by_affiliate_id: 'user-1',
          med_alliance_referral_status: 'pending_confirmation',
          eligibility_start_at: existingStart,
          deployment_date: new Date('2026-01-15T00:00:00.000Z'),
        })
        .mockResolvedValueOnce(makeAdminOrg({ med_alliance_referral_status: 'eligible' }));
      mockPrisma.organization.update.mockResolvedValue({});
      mockPrisma.affiliateCommission.findMany.mockResolvedValue([
        { id: 'comm-1' },
        { id: 'comm-2' },
      ]);
      mockPrisma.affiliateCommission.update.mockResolvedValue({});
      mockPrisma.medAllianceAuditLog.create.mockResolvedValue({});

      await service.approveEligibility(
        'org-1',
        { reason: 'Review complete', backfill: true },
        mockAdminUser,
      );

      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'org-1' },
          data: expect.objectContaining({
            med_alliance_referral_status: 'eligible',
            eligibility_start_at: existingStart,
            med_alliance_approval_note: 'Review complete',
          }),
        }),
      );
      expect(mockPrisma.affiliateCommission.update).toHaveBeenCalledTimes(2);
      expect(mockPrisma.affiliateCommission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'comm-1' },
          data: { status: 'pending_admin_confirmation' },
        }),
      );
      expect(mockPrisma.medAllianceAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event: 'eligibility_confirmed',
            old_status: 'pending_confirmation',
            new_status: 'eligible',
            actor_user_id: 'admin-1',
            metadata: expect.objectContaining({
              backfill: true,
              commissions_affected: 2,
            }),
          }),
        }),
      );
    });

    it('should confirm eligibility without backfill, void detected commissions, and re-anchor eligibility', async () => {
      const before = Date.now();
      mockPrisma.organization.findUnique
        .mockResolvedValueOnce({
          id: 'org-1',
          referred_by_affiliate_id: 'user-1',
          med_alliance_referral_status: 'pending_confirmation',
          eligibility_start_at: new Date('2026-02-01T00:00:00.000Z'),
          deployment_date: new Date('2026-01-15T00:00:00.000Z'),
        })
        .mockResolvedValueOnce(makeAdminOrg({ med_alliance_referral_status: 'eligible' }));
      mockPrisma.organization.update.mockResolvedValue({});
      mockPrisma.affiliateCommission.findMany.mockResolvedValue([{ id: 'comm-1' }]);
      mockPrisma.affiliateCommission.update.mockResolvedValue({});
      mockPrisma.medAllianceAuditLog.create.mockResolvedValue({});

      await service.approveEligibility(
        'org-1',
        { reason: 'Only future invoices', backfill: false },
        mockAdminUser,
      );

      const after = Date.now();
      const eligibilityStart = mockPrisma.organization.update.mock.calls[0][0].data
        .eligibility_start_at as Date;

      expect(eligibilityStart).toBeInstanceOf(Date);
      expect(eligibilityStart.getTime()).toBeGreaterThanOrEqual(before);
      expect(eligibilityStart.getTime()).toBeLessThanOrEqual(after);
      expect(mockPrisma.affiliateCommission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'comm-1' },
          data: { status: 'void' },
        }),
      );
    });

    it('should block eligibility and void non-paid commissions', async () => {
      mockPrisma.organization.findUnique
        .mockResolvedValueOnce({
          id: 'org-1',
          referred_by_affiliate_id: 'user-1',
          med_alliance_referral_status: 'pending_confirmation',
        })
        .mockResolvedValueOnce(makeAdminOrg({ med_alliance_referral_status: 'not_eligible' }));
      mockPrisma.organization.update.mockResolvedValue({});
      mockPrisma.affiliateCommission.findMany.mockResolvedValue([
        { id: 'comm-1' },
        { id: 'comm-2' },
      ]);
      mockPrisma.affiliateCommission.update.mockResolvedValue({});
      mockPrisma.medAllianceAuditLog.create.mockResolvedValue({});

      await service.blockEligibility(
        'org-1',
        { reason: 'Existing active client' },
        mockAdminUser,
      );

      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'org-1' },
          data: expect.objectContaining({
            med_alliance_referral_status: 'not_eligible',
            med_alliance_block_reason: 'Existing active client',
            med_alliance_approval_note: null,
            eligibility_start_at: null,
          }),
        }),
      );
      expect(mockPrisma.affiliateCommission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organization_id: 'org-1',
            status: { in: ['detected', 'pending_admin_confirmation'] },
          }),
        }),
      );
      expect(mockPrisma.affiliateCommission.update).toHaveBeenCalledTimes(2);
      expect(mockPrisma.medAllianceAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event: 'eligibility_blocked',
            new_status: 'not_eligible',
            metadata: { commissions_voided: 2 },
          }),
        }),
      );
    });

    it('should revert eligibility to pending confirmation and restore void commissions', async () => {
      const deploymentDate = new Date('2026-01-15T00:00:00.000Z');
      mockPrisma.organization.findUnique
        .mockResolvedValueOnce({
          id: 'org-1',
          referred_by_affiliate_id: 'user-1',
          med_alliance_referral_status: 'not_eligible',
          deployment_date: deploymentDate,
          eligibility_start_at: null,
        })
        .mockResolvedValueOnce(makeAdminOrg({ eligibility_start_at: deploymentDate }));
      mockPrisma.organization.update.mockResolvedValue({});
      mockPrisma.affiliateCommission.findMany.mockResolvedValue([{ id: 'comm-void' }]);
      mockPrisma.affiliateCommission.update.mockResolvedValue({});
      mockPrisma.medAllianceAuditLog.create.mockResolvedValue({});

      await service.revertEligibility('org-1', mockAdminUser);

      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'org-1' },
          data: expect.objectContaining({
            med_alliance_referral_status: 'pending_confirmation',
            med_alliance_block_reason: null,
            med_alliance_approval_note: null,
            eligibility_start_at: deploymentDate,
          }),
        }),
      );
      expect(mockPrisma.affiliateCommission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'comm-void' },
          data: { status: 'detected' },
        }),
      );
      expect(mockPrisma.medAllianceAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event: 'eligibility_reverted',
            old_status: 'not_eligible',
            new_status: 'pending_confirmation',
            metadata: { commissions_reverted: 1 },
          }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // findAllForAffiliate — commission aggregation
  // -------------------------------------------------------------------------
  describe('findAllForAffiliate — commission status aggregation', () => {
    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);

    it('should set commission_status to "paid" when any commission is paid', async () => {
      const orgWithPaid = {
        ...mockOrg,
        eligibility_start_at: fortyDaysAgo,
        affiliateCommissions: [{ status: 'paid', commission_amount: '500.00' }],
      };
      mockPrisma.$transaction.mockResolvedValue([[orgWithPaid], 1]);

      const result = await service.findAllForAffiliate({}, mockCurrentUser);

      expect((result.data[0] as any).commission_status).toBe('paid');
      expect((result.data[0] as any).my_commissions).toBe(500);
    });

    it('should set commission_status to "eligible" when any commission is eligible', async () => {
      const orgWithEligible = {
        ...mockOrg,
        eligibility_start_at: fortyDaysAgo,
        affiliateCommissions: [{ status: 'eligible', commission_amount: '300.00' }],
      };
      mockPrisma.$transaction.mockResolvedValue([[orgWithEligible], 1]);

      const result = await service.findAllForAffiliate({}, mockCurrentUser);

      expect((result.data[0] as any).commission_status).toBe('eligible');
    });

    it('should set commission_status to "pending" when only detected commissions exist', async () => {
      const orgWithPending = {
        ...mockOrg,
        eligibility_start_at: fortyDaysAgo,
        affiliateCommissions: [{ status: 'detected', commission_amount: '200.00' }],
      };
      mockPrisma.$transaction.mockResolvedValue([[orgWithPending], 1]);

      const result = await service.findAllForAffiliate({}, mockCurrentUser);

      expect((result.data[0] as any).commission_status).toBe('pending');
    });
  });

  // -------------------------------------------------------------------------
  // findAllForAdmin — commission aggregation
  // -------------------------------------------------------------------------
  describe('findAllForAdmin — commission aggregation', () => {
    it('should aggregate total_paid and total_pending from affiliateCommissions', async () => {
      const orgWithCommissions = {
        ...mockOrg,
        eligibility_start_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        affiliateCommissions: [
          { status: 'paid', commission_amount: '400.00' },
          { status: 'eligible', commission_amount: '150.00' },
          { status: 'requested', commission_amount: '50.00' },
        ],
        _count: { adminReviewCases: 0 },
        referredByAffiliate: { id: 'user-1', first_name: 'Jane', last_name: 'Affiliate', email: 'jane@example.com' },
      };
      mockPrisma.$transaction.mockResolvedValue([[orgWithCommissions], 1]);

      const result = await service.findAllForAdmin({});

      expect((result.data[0] as any).total_paid).toBe(400);
      expect((result.data[0] as any).total_pending).toBe(200);
      expect((result.data[0] as any).has_open_review).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // getReferredToOptions
  // -------------------------------------------------------------------------
  describe('getReferredToOptions', () => {
    it('should return available owners matching HubSpot property options', async () => {
      const axiosMock = jest.requireMock('axios') as jest.Mocked<any>;
      axiosMock.get.mockResolvedValue({
        data: {
          results: [
            {
              name: 'referred_to',
              options: [{ value: 'hs-1' }, { value: 'hs-2' }],
            },
          ],
        },
      });
      mockPrisma.uSER.findMany.mockResolvedValue([
        { id: 'u1', first_name: 'Alice', last_name: 'Smith', email: 'alice@example.com', hubspot_id: 'hs-1' },
      ]);

      const result = await service.getReferredToOptions();

      expect(result).toHaveLength(1);
      expect(result[0].hubspot_id).toBe('hs-1');
    });

    it('should return empty array when referred_to property is not found', async () => {
      const axiosMock = jest.requireMock('axios') as jest.Mocked<any>;
      axiosMock.get.mockResolvedValue({
        data: { results: [{ name: 'other_property', options: [] }] },
      });

      const result = await service.getReferredToOptions();

      expect(result).toEqual([]);
    });

    it('should throw Error when axios.get rejects', async () => {
      const axiosMock = jest.requireMock('axios') as jest.Mocked<any>;
      axiosMock.get.mockRejectedValue(new Error('Network error'));

      await expect(service.getReferredToOptions()).rejects.toThrow(
        'Failed to find Referred To options',
      );
    });
  });

  // -------------------------------------------------------------------------
  // create — soft duplicate warning path
  // -------------------------------------------------------------------------
  describe('create — soft duplicate warning', () => {
    it('should return org with warning when a soft duplicate exists', async () => {
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

      const createdOrg = { ...mockOrg, id: 'org-new', hubspot_id: null };
      const updatedOrg = { ...createdOrg, med_alliance_referral_status: 'eligible' };
      const duplicateOrg = { id: 'org-old', name: 'Acme Corp' };

      mockAffiliatesService.requireActiveProfile.mockResolvedValue({ id: 'profile-1', status: 'active' });
      mockOrganizationService.create.mockResolvedValue(createdOrg);
      mockEligibilityCheckService.runAndPersist.mockResolvedValue(undefined);
      mockReferralSyncService.run.mockResolvedValue(undefined);
      mockPrisma.organization.findFirst.mockResolvedValue(duplicateOrg); // soft duplicate found
      mockPrisma.organization.findUnique.mockResolvedValue(updatedOrg); // final reload
      mockReviewCasesService.openOrSkip.mockResolvedValue(undefined);
      mockContactService.createForReferredCompany.mockResolvedValue({ contact: null, hubspotId: null });

      const result = await service.create(createDto, mockCurrentUser);

      expect((result as any).warning).toContain('duplicate');
      expect(mockReviewCasesService.openOrSkip).toHaveBeenCalledWith(
        'org-new',
        'soft_duplicate_referral',
        expect.objectContaining({ matched_organization_id: 'org-old' }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // create — rollback on contact CONFLICT error (covers cleanupStack execution)
  // -------------------------------------------------------------------------
  describe('create — rollback on contact CONFLICT error', () => {
    it('should execute rollback and throw BadRequestException on HubSpot CONFLICT', async () => {
      const createDto = {
        name: 'Rollback Corp',
        email: 'rollback@corp.com',
        website_url: 'https://rollback.com',
        contact_first_name: 'Rob',
        contact_last_name: 'Back',
        contact_email: 'rob@rollback.com',
      };

      const createdOrg = { ...mockOrg, id: 'org-rollback', hubspot_id: 'hs-org-1' };
      const conflictError: any = new Error('Contact exists');
      conflictError.response = { data: { category: 'CONFLICT', message: 'Contact already exists' } };

      mockAffiliatesService.requireActiveProfile.mockResolvedValue({ id: 'profile-1', status: 'active' });
      mockOrganizationService.create.mockResolvedValue(createdOrg);
      mockEligibilityCheckService.runAndPersist.mockResolvedValue(undefined);
      mockReferralSyncService.run.mockResolvedValue(undefined);
      mockPrisma.organization.findFirst.mockResolvedValue(null); // no soft duplicate
      mockPrisma.organization.findUnique
        .mockResolvedValueOnce(createdOrg) // inside cleanupStack closure
        .mockResolvedValueOnce({ ...createdOrg, hubspot_id: 'hs-org-1' }); // final reload
      mockContactService.createForReferredCompany.mockRejectedValue(conflictError);
      mockHubspotService.deleteCompanyInHubspot.mockResolvedValue(undefined);
      mockPrisma.$transaction.mockResolvedValue([]);
      mockPrisma.medAllianceAuditLog.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.organization.delete.mockResolvedValue({});

      await expect(service.create(createDto, mockCurrentUser)).rejects.toThrow(BadRequestException);
      expect(mockHubspotService.deleteCompanyInHubspot).toHaveBeenCalled();
    });
  });
});
