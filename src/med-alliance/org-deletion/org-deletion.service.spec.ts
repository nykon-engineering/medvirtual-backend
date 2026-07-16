import { Test, TestingModule } from '@nestjs/testing';
import { OrgDeletionService } from './org-deletion.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ReviewCasesService } from '../review-cases/review-cases.service';
import { AllianceNotificationsService } from '../notifications/notifications.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockPrisma = {
  organization: { findUnique: jest.fn() },
  affiliateCommission: { findMany: jest.fn(), updateMany: jest.fn() },
  medAllianceAdminReviewCase: { updateMany: jest.fn() },
  medAllianceAuditLog: { create: jest.fn(), createMany: jest.fn() },
};

const mockReviewCases = {
  openOrSkip: jest.fn(),
};

const mockAllianceNotifications = {
  notifyAdminReferredOrgDeleted: jest.fn(),
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const makeOrg = (overrides: Partial<any> = {}) => ({
  id: 'org-1',
  name: 'Acme Corp',
  referred_by_affiliate_id: 'user-1',
  referredByAffiliate: {
    email: 'partner@example.com',
    first_name: 'Jane',
    last_name: 'Partner',
  },
  ...overrides,
});

const makeCommission = (overrides: Partial<any> = {}) => ({
  id: 'commission-1',
  status: 'eligible',
  ...overrides,
});

describe('OrgDeletionService', () => {
  let service: OrgDeletionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrgDeletionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ReviewCasesService, useValue: mockReviewCases },
        {
          provide: AllianceNotificationsService,
          useValue: mockAllianceNotifications,
        },
      ],
    }).compile();

    service = module.get<OrgDeletionService>(OrgDeletionService);

    mockPrisma.affiliateCommission.findMany.mockResolvedValue([]);
    mockPrisma.affiliateCommission.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.medAllianceAdminReviewCase.updateMany.mockResolvedValue({
      count: 0,
    });
    mockPrisma.medAllianceAuditLog.create.mockResolvedValue({});
    mockPrisma.medAllianceAuditLog.createMany.mockResolvedValue({ count: 0 });
    mockReviewCases.openOrSkip.mockResolvedValue({ opened: true });
    mockAllianceNotifications.notifyAdminReferredOrgDeleted.mockResolvedValue(
      undefined,
    );
  });

  afterEach(() => jest.clearAllMocks());

  it('should be a no-op for an organization that was not referred by an affiliate', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(
      makeOrg({ referred_by_affiliate_id: null, referredByAffiliate: null }),
    );

    await service.onOrganizationDeleted('org-1');

    expect(mockPrisma.affiliateCommission.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.medAllianceAuditLog.create).not.toHaveBeenCalled();
  });

  it('should be a no-op when the organization does not exist', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null);

    await service.onOrganizationDeleted('org-x');

    expect(mockPrisma.affiliateCommission.findMany).not.toHaveBeenCalled();
  });

  it('should void non-terminal commissions (detected, pending_admin_confirmation, eligible)', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(makeOrg());
    mockPrisma.affiliateCommission.findMany.mockResolvedValueOnce([
      makeCommission({ id: 'c-1', status: 'detected' }),
      makeCommission({ id: 'c-2', status: 'eligible' }),
    ]);
    // second findMany call: requested commissions — none
    mockPrisma.affiliateCommission.findMany.mockResolvedValueOnce([]);

    await service.onOrganizationDeleted('org-1');

    expect(mockPrisma.affiliateCommission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: 'org-1',
          status: {
            in: ['detected', 'pending_admin_confirmation', 'eligible'],
          },
        }),
      }),
    );
    expect(mockPrisma.affiliateCommission.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['c-1', 'c-2'] } }),
        data: { status: 'void' },
      }),
    );
  });

  it('should write one audit log entry per voided commission with reason org_deleted', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(makeOrg());
    mockPrisma.affiliateCommission.findMany.mockResolvedValueOnce([
      makeCommission({ id: 'c-1', status: 'eligible' }),
    ]);
    mockPrisma.affiliateCommission.findMany.mockResolvedValueOnce([]);

    await service.onOrganizationDeleted('org-1');

    expect(mockPrisma.medAllianceAuditLog.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            entity_type: 'commission',
            entity_id: 'c-1',
            event: 'voided_org_deleted',
            old_status: 'eligible',
            new_status: 'void',
            reason: 'org_deleted',
            source: 'sync',
          }),
        ]),
      }),
    );
  });

  it('should open a review case instead of voiding when requested commissions exist', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(makeOrg());
    // no non-terminal commissions
    mockPrisma.affiliateCommission.findMany.mockResolvedValueOnce([]);
    // one requested commission (already inside a payout request)
    mockPrisma.affiliateCommission.findMany.mockResolvedValueOnce([
      makeCommission({ id: 'c-9', status: 'requested' }),
    ]);

    await service.onOrganizationDeleted('org-1');

    expect(mockPrisma.affiliateCommission.updateMany).not.toHaveBeenCalled();
    expect(mockReviewCases.openOrSkip).toHaveBeenCalledWith(
      'org-1',
      'org_deleted_with_pending_payout',
      expect.objectContaining({ commission_ids: ['c-9'] }),
    );
  });

  it('should close other open review cases for the deleted organization', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(makeOrg());

    await service.onOrganizationDeleted('org-1');

    expect(
      mockPrisma.medAllianceAdminReviewCase.updateMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: 'org-1',
          status: 'open',
        }),
        data: expect.objectContaining({ status: 'resolved' }),
      }),
    );
  });

  it('should write an organization-level audit log entry with event organization_deleted', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(makeOrg());

    await service.onOrganizationDeleted('org-1');

    expect(mockPrisma.medAllianceAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entity_type: 'referred_company',
          entity_id: 'org-1',
          event: 'organization_deleted',
          source: 'sync',
        }),
      }),
    );
  });

  it('should notify admins about the deleted referred organization', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(makeOrg());
    mockPrisma.affiliateCommission.findMany.mockResolvedValueOnce([
      makeCommission({ id: 'c-1', status: 'eligible' }),
    ]);
    mockPrisma.affiliateCommission.findMany.mockResolvedValueOnce([]);

    await service.onOrganizationDeleted('org-1');

    expect(
      mockAllianceNotifications.notifyAdminReferredOrgDeleted,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationName: 'Acme Corp',
        affiliateName: 'Jane Partner',
      }),
    );
  });

  it('should fall back to "Unknown affiliate" when the referring user record is missing', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(
      makeOrg({ referredByAffiliate: null }),
    );

    await service.onOrganizationDeleted('org-1');

    expect(
      mockAllianceNotifications.notifyAdminReferredOrgDeleted,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ affiliateName: 'Unknown affiliate' }),
    );
  });

  it('should never throw when notification sending fails', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(makeOrg());
    mockAllianceNotifications.notifyAdminReferredOrgDeleted.mockRejectedValue(
      new Error('smtp down'),
    );

    await expect(service.onOrganizationDeleted('org-1')).resolves.not.toThrow();
  });
});
