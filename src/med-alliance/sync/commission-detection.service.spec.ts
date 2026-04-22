import { Test, TestingModule } from '@nestjs/testing';
import { CommissionDetectionService } from './commission-detection.service';
import { PrismaService } from '../../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockPrisma = {
  organization: { findUnique: jest.fn() },
  affiliateProfile: { findFirst: jest.fn() },
  hubspotInvoiceSnapshot: { findMany: jest.fn() },
  affiliateCommission: { create: jest.fn() },
  medAllianceAuditLog: { create: jest.fn() },
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const makeOrg = (overrides: Partial<any> = {}) => ({
  id: 'org-1',
  referred_by_affiliate_id: 'user-1',
  med_alliance_referral_status: 'eligible',
  med_alliance_block_reason: null,
  eligibility_start_at: new Date('2026-01-01'),
  first_paid_invoice_at: new Date('2026-01-01'),
  createdAt: new Date('2025-01-01'),
  ...overrides,
});

const makeProfile = (overrides: Partial<any> = {}) => ({
  id: 'profile-1',
  user_id: 'user-1',
  commission_percent_default: '10.00',
  ...overrides,
});

const makeSnapshot = (overrides: Partial<any> = {}) => ({
  id: 'snap-1',
  hubspot_id: 'inv-1',
  invoice_amount: '1500.00',
  payment_status: null,
  paid_at: new Date('2026-02-10'),
  ...overrides,
});

describe('CommissionDetectionService', () => {
  let service: CommissionDetectionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommissionDetectionService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CommissionDetectionService>(CommissionDetectionService);
  });

  afterEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------
  // Guard: no affiliate
  // -------------------------------------------------------------------------
  it('should return zeros when org has no referred_by_affiliate_id', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(
      makeOrg({ referred_by_affiliate_id: null }),
    );

    const result = await service.run('org-1');

    expect(result).toEqual({ created: 0, skipped: 0 });
    expect(mockPrisma.affiliateProfile.findFirst).not.toHaveBeenCalled();
  });

  it('should return zeros when org does not exist', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null);

    const result = await service.run('non-existent');

    expect(result).toEqual({ created: 0, skipped: 0 });
  });

  // -------------------------------------------------------------------------
  // Guard: ineligible referral
  // -------------------------------------------------------------------------
  it('should return zeros when org is blocked as active client (MA-004)', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(
      makeOrg({
        med_alliance_referral_status: 'not_eligible',
        med_alliance_block_reason: 'active_client_block: organization_active_by_email',
      }),
    );

    const result = await service.run('org-1');

    expect(result).toEqual({ created: 0, skipped: 0 });
    expect(mockPrisma.affiliateProfile.findFirst).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Guard: no active affiliate profile
  // -------------------------------------------------------------------------
  it('should return zeros when affiliate has no active profile', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(makeOrg());
    mockPrisma.affiliateProfile.findFirst.mockResolvedValue(null);

    const result = await service.run('org-1');

    expect(result).toEqual({ created: 0, skipped: 0 });
    expect(mockPrisma.hubspotInvoiceSnapshot.findMany).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // No candidate snapshots
  // -------------------------------------------------------------------------
  it('should return zeros when no eligible snapshots exist for the org', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(makeOrg());
    mockPrisma.affiliateProfile.findFirst.mockResolvedValue(makeProfile());
    mockPrisma.hubspotInvoiceSnapshot.findMany.mockResolvedValue([]);

    const result = await service.run('org-1');

    expect(result).toEqual({ created: 0, skipped: 0 });
    expect(mockPrisma.affiliateCommission.create).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Post-filter: payment_status
  // -------------------------------------------------------------------------
  it('should filter out snapshots with non-succeeded payment_status', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(makeOrg());
    mockPrisma.affiliateProfile.findFirst.mockResolvedValue(makeProfile());
    mockPrisma.hubspotInvoiceSnapshot.findMany.mockResolvedValue([
      makeSnapshot({ payment_status: null }),           // eligible
      makeSnapshot({ id: 'snap-2', hubspot_id: 'inv-2', payment_status: 'succeeded' }), // eligible
      makeSnapshot({ id: 'snap-3', hubspot_id: 'inv-3', payment_status: 'failed' }),    // filtered out
      makeSnapshot({ id: 'snap-4', hubspot_id: 'inv-4', payment_status: 'pending' }),   // filtered out
    ]);
    mockPrisma.affiliateCommission.create.mockResolvedValue({});
    mockPrisma.medAllianceAuditLog.create.mockResolvedValue({});

    const result = await service.run('org-1');

    // Only 2 snapshots pass the payment_status filter
    expect(result.created).toBe(2);
    expect(mockPrisma.affiliateCommission.create).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  // Commission creation
  // -------------------------------------------------------------------------
  describe('commission creation', () => {
    it('should create commission with correct fields', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(makeOrg());
      mockPrisma.affiliateProfile.findFirst.mockResolvedValue({
        id: 'profile-1',
        user_id: 'user-1',
        commission_percent_default: '10.00',
      });
      mockPrisma.hubspotInvoiceSnapshot.findMany.mockResolvedValue([
        makeSnapshot({ invoice_amount: '1500.00' }),
      ]);
      mockPrisma.affiliateCommission.create.mockResolvedValue({});
      mockPrisma.medAllianceAuditLog.create.mockResolvedValue({});

      await service.run('org-1');

      expect(mockPrisma.affiliateCommission.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            affiliate_id: 'user-1',
            affiliate_profile_id: 'profile-1',
            organization_id: 'org-1',
            hubspot_invoice_snapshot_id: 'snap-1',
            status: 'detected',
          }),
        }),
      );
    });

    it('should write exactly one audit log entry per created commission', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(makeOrg());
      mockPrisma.affiliateProfile.findFirst.mockResolvedValue({
        id: 'profile-1',
        user_id: 'user-1',
        commission_percent_default: '10.00',
      });
      mockPrisma.hubspotInvoiceSnapshot.findMany.mockResolvedValue([
        makeSnapshot({ id: 'snap-1', hubspot_id: 'inv-1' }),
        makeSnapshot({ id: 'snap-2', hubspot_id: 'inv-2' }),
      ]);
      mockPrisma.affiliateCommission.create.mockResolvedValue({});
      mockPrisma.medAllianceAuditLog.create.mockResolvedValue({});

      await service.run('org-1');

      expect(mockPrisma.medAllianceAuditLog.create).toHaveBeenCalledTimes(2);
    });

    it('should set audit log source to sync', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(makeOrg());
      mockPrisma.affiliateProfile.findFirst.mockResolvedValue({
        id: 'profile-1',
        user_id: 'user-1',
        commission_percent_default: '10.00',
      });
      mockPrisma.hubspotInvoiceSnapshot.findMany.mockResolvedValue([makeSnapshot()]);
      mockPrisma.affiliateCommission.create.mockResolvedValue({});
      mockPrisma.medAllianceAuditLog.create.mockResolvedValue({});

      await service.run('org-1');

      expect(mockPrisma.medAllianceAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            source: 'sync',
            event: 'commission_detected',
            new_status: 'detected',
          }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Idempotency — P2002
  // -------------------------------------------------------------------------
  describe('idempotency', () => {
    it('should count as skipped when P2002 unique constraint is violated', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(makeOrg());
      mockPrisma.affiliateProfile.findFirst.mockResolvedValue({
        id: 'profile-1',
        user_id: 'user-1',
        commission_percent_default: '10.00',
      });
      mockPrisma.hubspotInvoiceSnapshot.findMany.mockResolvedValue([makeSnapshot()]);

      const prismaUniqueError = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
      mockPrisma.affiliateCommission.create.mockRejectedValue(prismaUniqueError);
      mockPrisma.medAllianceAuditLog.create.mockResolvedValue({});

      const result = await service.run('org-1');

      expect(result.skipped).toBe(1);
      expect(result.created).toBe(0);
      // Audit log should not be written for skipped commissions
      expect(mockPrisma.medAllianceAuditLog.create).not.toHaveBeenCalled();
    });

    it('should produce the same idempotency_key for the same inputs', async () => {
      const profile = { id: 'profile-1', user_id: 'user-1', commission_percent_default: '10.00' };
      const snap = makeSnapshot({ paid_at: new Date('2026-02-10T00:00:00.000Z') });

      mockPrisma.organization.findUnique.mockResolvedValue(makeOrg());
      mockPrisma.affiliateProfile.findFirst.mockResolvedValue(profile);
      mockPrisma.hubspotInvoiceSnapshot.findMany.mockResolvedValue([snap]);
      mockPrisma.affiliateCommission.create.mockResolvedValue({});
      mockPrisma.medAllianceAuditLog.create.mockResolvedValue({});

      await service.run('org-1');
      const key1 =
        mockPrisma.affiliateCommission.create.mock.calls[0][0].data.idempotency_key;

      jest.clearAllMocks();
      mockPrisma.organization.findUnique.mockResolvedValue(makeOrg());
      mockPrisma.affiliateProfile.findFirst.mockResolvedValue(profile);
      mockPrisma.hubspotInvoiceSnapshot.findMany.mockResolvedValue([snap]);
      mockPrisma.affiliateCommission.create.mockResolvedValue({});
      mockPrisma.medAllianceAuditLog.create.mockResolvedValue({});

      await service.run('org-1');
      const key2 =
        mockPrisma.affiliateCommission.create.mock.calls[0][0].data.idempotency_key;

      expect(key1).toBe(key2);
      expect(key1).toHaveLength(64); // SHA-256 hex
    });

    it('should produce different idempotency_keys for different invoice amounts', async () => {
      const profile = { id: 'profile-1', user_id: 'user-1', commission_percent_default: '10.00' };

      const runWith = async (amount: string) => {
        jest.clearAllMocks();
        mockPrisma.organization.findUnique.mockResolvedValue(makeOrg());
        mockPrisma.affiliateProfile.findFirst.mockResolvedValue(profile);
        mockPrisma.hubspotInvoiceSnapshot.findMany.mockResolvedValue([
          makeSnapshot({ invoice_amount: amount }),
        ]);
        mockPrisma.affiliateCommission.create.mockResolvedValue({});
        mockPrisma.medAllianceAuditLog.create.mockResolvedValue({});
        await service.run('org-1');
        return mockPrisma.affiliateCommission.create.mock.calls[0][0].data.idempotency_key;
      };

      const key1 = await runWith('1500.00');
      const key2 = await runWith('2000.00');

      expect(key1).not.toBe(key2);
    });

    it('should continue processing remaining snapshots when one fails with non-P2002 error', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(makeOrg());
      mockPrisma.affiliateProfile.findFirst.mockResolvedValue({
        id: 'profile-1',
        user_id: 'user-1',
        commission_percent_default: '10.00',
      });
      mockPrisma.hubspotInvoiceSnapshot.findMany.mockResolvedValue([
        makeSnapshot({ id: 'snap-1', hubspot_id: 'inv-1' }),
        makeSnapshot({ id: 'snap-2', hubspot_id: 'inv-2' }),
      ]);
      mockPrisma.affiliateCommission.create
        .mockRejectedValueOnce(new Error('DB connection lost'))
        .mockResolvedValueOnce({});
      mockPrisma.medAllianceAuditLog.create.mockResolvedValue({});

      const result = await service.run('org-1');

      // One failed, one created
      expect(result.created).toBe(1);
    });
  });
});
