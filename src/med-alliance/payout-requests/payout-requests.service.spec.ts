import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PayoutRequestsService } from './payout-requests.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AffiliatesService } from '../affiliates/affiliates.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockPrisma = {
  affiliateCommission: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
  affiliatePayoutRequest: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  affiliatePayoutRequestCommission: {
    createMany: jest.fn(),
  },
  medAllianceAuditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockAffiliatesService = {
  requireActiveProfile: jest.fn(),
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const mockAdminUser = {
  id: 'admin-1',
  first_name: 'Admin',
  last_name: 'User',
  role: 'system_admin',
} as any;

const mockAffiliateUser = {
  id: 'affiliate-1',
  first_name: 'Jane',
  last_name: 'Affiliate',
  role: 'organization_admin',
} as any;

const mockProfile = {
  id: 'profile-1',
  user_id: 'affiliate-1',
  status: 'active',
  payout_preference_method: 'ach',
};

const makeCommission = (overrides: Partial<any> = {}) => ({
  id: 'commission-1',
  affiliate_id: 'affiliate-1',
  status: 'eligible',
  commission_amount: '150.00',
  ...overrides,
});

const makePayoutRequest = (overrides: Partial<any> = {}) => ({
  id: 'payout-1',
  affiliate_id: 'affiliate-1',
  affiliate_profile_id: 'profile-1',
  status: 'requested',
  requested_amount: '150.00',
  approved_amount: null,
  payment_method: 'ach',
  payment_reference: null,
  approved_by: null,
  approved_at: null,
  paid_at: null,
  rejection_reason: null,
  createdAt: new Date('2026-03-01'),
  updatedAt: new Date('2026-03-01'),
  commissions: [
    { commission: { id: 'commission-1', commission_amount: '150.00', status: 'requested', organization: { id: 'org-1', name: 'Acme' } } },
  ],
  ...overrides,
});

describe('PayoutRequestsService', () => {
  let service: PayoutRequestsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutRequestsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AffiliatesService, useValue: mockAffiliatesService },
      ],
    }).compile();

    service = module.get<PayoutRequestsService>(PayoutRequestsService);
  });

  afterEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------
  describe('create', () => {
    const createDto = { commission_ids: ['commission-1'], payment_method: undefined } as any;

    it('should throw ForbiddenException when affiliate profile is inactive or missing', async () => {
      mockAffiliatesService.requireActiveProfile.mockRejectedValue(
        new BadRequestException('Affiliate profile is inactive'),
      );

      await expect(service.create(createDto, mockAffiliateUser)).rejects.toThrow();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when a commission ID is not found', async () => {
      mockAffiliatesService.requireActiveProfile.mockResolvedValue(mockProfile);
      // Return fewer commissions than requested (simulates missing ID)
      mockPrisma.affiliateCommission.findMany.mockResolvedValue([]);

      await expect(service.create(createDto, mockAffiliateUser)).rejects.toThrow(
        new BadRequestException('One or more commission IDs were not found'),
      );
    });

    it('should throw BadRequestException when a commission belongs to another affiliate', async () => {
      mockAffiliatesService.requireActiveProfile.mockResolvedValue(mockProfile);
      mockPrisma.affiliateCommission.findMany.mockResolvedValue([
        makeCommission({ affiliate_id: 'other-user' }),
      ]);

      await expect(service.create(createDto, mockAffiliateUser)).rejects.toThrow(
        new BadRequestException('One or more commissions do not belong to your account'),
      );
    });

    it('should throw BadRequestException when a commission is not in "eligible" status', async () => {
      mockAffiliatesService.requireActiveProfile.mockResolvedValue(mockProfile);
      mockPrisma.affiliateCommission.findMany.mockResolvedValue([
        makeCommission({ status: 'detected' }),
      ]);

      await expect(service.create(createDto, mockAffiliateUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create payout request, junction records and update commissions in a transaction', async () => {
      mockAffiliatesService.requireActiveProfile.mockResolvedValue(mockProfile);
      mockPrisma.affiliateCommission.findMany.mockResolvedValue([makeCommission()]);

      // $transaction receives a callback — execute it with a tx mock
      const txMock = {
        affiliatePayoutRequest: { create: jest.fn().mockResolvedValue({ id: 'payout-1' }) },
        affiliatePayoutRequestCommission: { createMany: jest.fn().mockResolvedValue({}) },
        affiliateCommission: { updateMany: jest.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(txMock));
      mockPrisma.affiliatePayoutRequest.findUnique.mockResolvedValue(makePayoutRequest());
      mockPrisma.medAllianceAuditLog.create.mockResolvedValue({});

      const result = await service.create(createDto, mockAffiliateUser);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(txMock.affiliatePayoutRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            affiliate_id: 'affiliate-1',
            affiliate_profile_id: 'profile-1',
            status: 'requested',
          }),
        }),
      );
      expect(txMock.affiliatePayoutRequestCommission.createMany).toHaveBeenCalledWith({
        data: [{ payout_request_id: 'payout-1', commission_id: 'commission-1' }],
      });
      expect(txMock.affiliateCommission.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['commission-1'] } },
        data: { status: 'requested' },
      });
      expect(result).toEqual(makePayoutRequest());
    });

    it('should calculate requested_amount as sum of commission_amounts', async () => {
      mockAffiliatesService.requireActiveProfile.mockResolvedValue(mockProfile);
      mockPrisma.affiliateCommission.findMany.mockResolvedValue([
        makeCommission({ id: 'c-1', commission_amount: '100.00' }),
        makeCommission({ id: 'c-2', commission_amount: '250.50' }),
      ]);

      const txMock = {
        affiliatePayoutRequest: { create: jest.fn().mockResolvedValue({ id: 'payout-1' }) },
        affiliatePayoutRequestCommission: { createMany: jest.fn().mockResolvedValue({}) },
        affiliateCommission: { updateMany: jest.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(txMock));
      mockPrisma.affiliatePayoutRequest.findUnique.mockResolvedValue(makePayoutRequest());
      mockPrisma.medAllianceAuditLog.create.mockResolvedValue({});

      await service.create(
        { commission_ids: ['c-1', 'c-2'] } as any,
        mockAffiliateUser,
      );

      const createCall = txMock.affiliatePayoutRequest.create.mock.calls[0][0];
      // 100.00 + 250.50 = 350.50
      expect(createCall.data.requested_amount.toString()).toBe('350.5');
    });

    it('should use DTO payment_method when provided, otherwise fall back to profile default', async () => {
      mockAffiliatesService.requireActiveProfile.mockResolvedValue({
        ...mockProfile,
        payout_preference_method: 'ach',
      });
      mockPrisma.affiliateCommission.findMany.mockResolvedValue([makeCommission()]);

      const txMock = {
        affiliatePayoutRequest: { create: jest.fn().mockResolvedValue({ id: 'payout-1' }) },
        affiliatePayoutRequestCommission: { createMany: jest.fn().mockResolvedValue({}) },
        affiliateCommission: { updateMany: jest.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(txMock));
      mockPrisma.affiliatePayoutRequest.findUnique.mockResolvedValue(makePayoutRequest());
      mockPrisma.medAllianceAuditLog.create.mockResolvedValue({});

      // DTO overrides with 'wire'
      await service.create({ commission_ids: ['commission-1'], payment_method: 'wire' } as any, mockAffiliateUser);

      const createCall = txMock.affiliatePayoutRequest.create.mock.calls[0][0];
      expect(createCall.data.payment_method).toBe('wire');
    });

    it('should write audit log entries for payout request and each commission', async () => {
      mockAffiliatesService.requireActiveProfile.mockResolvedValue(mockProfile);
      mockPrisma.affiliateCommission.findMany.mockResolvedValue([makeCommission()]);

      const txMock = {
        affiliatePayoutRequest: { create: jest.fn().mockResolvedValue({ id: 'payout-1' }) },
        affiliatePayoutRequestCommission: { createMany: jest.fn().mockResolvedValue({}) },
        affiliateCommission: { updateMany: jest.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(txMock));
      mockPrisma.affiliatePayoutRequest.findUnique.mockResolvedValue(makePayoutRequest());
      mockPrisma.medAllianceAuditLog.create.mockResolvedValue({});

      await service.create(createDto, mockAffiliateUser);

      // Should have written audit for payout request + 1 commission = 2 entries
      expect(mockPrisma.medAllianceAuditLog.create).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  // findAllForAffiliate
  // -------------------------------------------------------------------------
  describe('findAllForAffiliate', () => {
    it('should return paginated payout requests scoped to the current affiliate', async () => {
      mockPrisma.$transaction.mockResolvedValue([[makePayoutRequest()], 1]);

      const result = await service.findAllForAffiliate({}, mockAffiliateUser);

      expect(result.data).toHaveLength(1);
      expect(result.pagination).toEqual({ page: 1, limit: 20, total: 1 });
    });

    it('should filter by status', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      const result = await service.findAllForAffiliate(
        { status: 'paid' as any },
        mockAffiliateUser,
      );

      expect(result.data).toHaveLength(0);
    });

    it('should apply date range filters', async () => {
      mockPrisma.$transaction.mockResolvedValue([[makePayoutRequest()], 1]);

      const result = await service.findAllForAffiliate(
        { created_from: '2026-01-01', created_to: '2026-12-31' },
        mockAffiliateUser,
      );

      expect(result.data).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // findOneForAffiliate
  // -------------------------------------------------------------------------
  describe('findOneForAffiliate', () => {
    it('should throw NotFoundException when payout request does not exist', async () => {
      mockPrisma.affiliatePayoutRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.findOneForAffiliate('payout-99', mockAffiliateUser),
      ).rejects.toThrow(new NotFoundException('Payout request not found'));
    });

    it('should throw NotFoundException when payout request belongs to another affiliate', async () => {
      mockPrisma.affiliatePayoutRequest.findUnique.mockResolvedValue(
        makePayoutRequest({ affiliate_id: 'other-user' }),
      );

      await expect(
        service.findOneForAffiliate('payout-1', mockAffiliateUser),
      ).rejects.toThrow(new NotFoundException('Payout request not found'));
    });

    it('should return the payout request when it belongs to the current affiliate', async () => {
      mockPrisma.affiliatePayoutRequest.findUnique.mockResolvedValue(makePayoutRequest());

      const result = await service.findOneForAffiliate('payout-1', mockAffiliateUser);

      expect(result.id).toBe('payout-1');
    });
  });

  // -------------------------------------------------------------------------
  // findAllForAdmin
  // -------------------------------------------------------------------------
  describe('findAllForAdmin', () => {
    it('should return all payout requests without affiliate scoping', async () => {
      const requestWithDetails = {
        ...makePayoutRequest(),
        affiliate: { id: 'affiliate-1', first_name: 'Jane', last_name: 'Affiliate', email: 'jane@example.com' },
        approvedBy: null,
      };
      mockPrisma.$transaction.mockResolvedValue([[requestWithDetails], 1]);

      const result = await service.findAllForAdmin({});

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty('affiliate');
    });

    it('should filter by affiliate_id', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      const result = await service.findAllForAdmin({ affiliate_id: 'affiliate-99' });

      expect(result.data).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // findOneForAdmin
  // -------------------------------------------------------------------------
  describe('findOneForAdmin', () => {
    it('should throw NotFoundException when payout request does not exist', async () => {
      mockPrisma.affiliatePayoutRequest.findUnique.mockResolvedValue(null);

      await expect(service.findOneForAdmin('payout-99')).rejects.toThrow(
        new NotFoundException('Payout request not found'),
      );
    });

    it('should return payout request with affiliate and approvedBy details', async () => {
      const fullRequest = {
        ...makePayoutRequest({ status: 'approved', approved_by: 'admin-1' }),
        affiliate: { id: 'affiliate-1', first_name: 'Jane', last_name: 'Affiliate', email: 'jane@example.com' },
        approvedBy: { id: 'admin-1', first_name: 'Admin', last_name: 'User' },
      };
      mockPrisma.affiliatePayoutRequest.findUnique.mockResolvedValue(fullRequest);

      const result = await service.findOneForAdmin('payout-1');

      expect((result as any).approvedBy.id).toBe('admin-1');
    });
  });

  // -------------------------------------------------------------------------
  // decide
  // -------------------------------------------------------------------------
  describe('decide', () => {
    it('should throw NotFoundException when payout request does not exist', async () => {
      mockPrisma.affiliatePayoutRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.decide('payout-99', { decision: 'approved' }, mockAdminUser),
      ).rejects.toThrow(new NotFoundException('Payout request not found'));
    });

    it('should throw BadRequestException when payout request is not in "requested" status', async () => {
      mockPrisma.affiliatePayoutRequest.findUnique.mockResolvedValue(
        makePayoutRequest({ status: 'approved' }),
      );

      await expect(
        service.decide('payout-1', { decision: 'approved' }, mockAdminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should approve the payout request and set approved_amount', async () => {
      mockPrisma.affiliatePayoutRequest.findUnique
        .mockResolvedValueOnce({
          ...makePayoutRequest(),
          commissions: [{ commission_id: 'commission-1' }],
        })
        .mockResolvedValueOnce(makePayoutRequest({ status: 'approved', approved_amount: '150.00', approved_by: 'admin-1' }));

      const txMock = {
        affiliatePayoutRequest: { update: jest.fn().mockResolvedValue({}) },
        affiliateCommission: { updateMany: jest.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(txMock));
      mockPrisma.medAllianceAuditLog.create.mockResolvedValue({});

      const result = await service.decide(
        'payout-1',
        { decision: 'approved', approved_amount: 150 },
        mockAdminUser,
      );

      expect(txMock.affiliatePayoutRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'approved', approved_by: 'admin-1' }),
        }),
      );
      // On approval, commissions should NOT be reverted
      expect(txMock.affiliateCommission.updateMany).not.toHaveBeenCalled();
    });

    it('should reject the payout request and revert commissions to "eligible"', async () => {
      const commissionIds = ['commission-1', 'commission-2'];
      mockPrisma.affiliatePayoutRequest.findUnique
        .mockResolvedValueOnce({
          ...makePayoutRequest(),
          commissions: commissionIds.map((id) => ({ commission_id: id })),
        })
        .mockResolvedValueOnce(makePayoutRequest({ status: 'rejected' }));

      const txMock = {
        affiliatePayoutRequest: { update: jest.fn().mockResolvedValue({}) },
        affiliateCommission: { updateMany: jest.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(txMock));
      mockPrisma.medAllianceAuditLog.create.mockResolvedValue({});

      await service.decide(
        'payout-1',
        { decision: 'rejected', rejection_reason: 'Insufficient documentation' },
        mockAdminUser,
      );

      expect(txMock.affiliateCommission.updateMany).toHaveBeenCalledWith({
        where: { id: { in: commissionIds } },
        data: { status: 'eligible' },
      });
    });

    it('should write audit log entries for the request and each reverted commission on rejection', async () => {
      mockPrisma.affiliatePayoutRequest.findUnique
        .mockResolvedValueOnce({
          ...makePayoutRequest(),
          commissions: [{ commission_id: 'commission-1' }],
        })
        .mockResolvedValueOnce(makePayoutRequest({ status: 'rejected' }));

      const txMock = {
        affiliatePayoutRequest: { update: jest.fn().mockResolvedValue({}) },
        affiliateCommission: { updateMany: jest.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(txMock));
      mockPrisma.medAllianceAuditLog.create.mockResolvedValue({});

      await service.decide(
        'payout-1',
        { decision: 'rejected', rejection_reason: 'Insufficient documentation' },
        mockAdminUser,
      );

      // 1 for payout request + 1 for each reverted commission
      expect(mockPrisma.medAllianceAuditLog.create).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  // markPaid
  // -------------------------------------------------------------------------
  describe('markPaid', () => {
    it('should throw NotFoundException when payout request does not exist', async () => {
      mockPrisma.affiliatePayoutRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.markPaid('payout-99', {}, mockAdminUser),
      ).rejects.toThrow(new NotFoundException('Payout request not found'));
    });

    it('should throw BadRequestException when payout request is not in "approved" status', async () => {
      mockPrisma.affiliatePayoutRequest.findUnique.mockResolvedValue(
        makePayoutRequest({ status: 'requested' }),
      );

      await expect(
        service.markPaid('payout-1', {}, mockAdminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should mark payout request as paid and update commissions to "paid"', async () => {
      const commissionIds = ['commission-1'];
      mockPrisma.affiliatePayoutRequest.findUnique
        .mockResolvedValueOnce({
          ...makePayoutRequest({ status: 'approved' }),
          commissions: commissionIds.map((id) => ({ commission_id: id })),
        })
        .mockResolvedValueOnce(makePayoutRequest({ status: 'paid', paid_at: new Date() }));

      const txMock = {
        affiliatePayoutRequest: { update: jest.fn().mockResolvedValue({}) },
        affiliateCommission: { updateMany: jest.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(txMock));
      mockPrisma.medAllianceAuditLog.create.mockResolvedValue({});

      const result = await service.markPaid(
        'payout-1',
        { payment_reference: 'WIRE-001' },
        mockAdminUser,
      );

      expect(txMock.affiliatePayoutRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'paid',
            payment_reference: 'WIRE-001',
          }),
        }),
      );
      expect(txMock.affiliateCommission.updateMany).toHaveBeenCalledWith({
        where: { id: { in: commissionIds } },
        data: { status: 'paid' },
      });
    });

    it('should use provided paid_at timestamp when given', async () => {
      mockPrisma.affiliatePayoutRequest.findUnique
        .mockResolvedValueOnce({
          ...makePayoutRequest({ status: 'approved' }),
          commissions: [{ commission_id: 'commission-1' }],
        })
        .mockResolvedValueOnce(makePayoutRequest({ status: 'paid' }));

      const txMock = {
        affiliatePayoutRequest: { update: jest.fn().mockResolvedValue({}) },
        affiliateCommission: { updateMany: jest.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(txMock));
      mockPrisma.medAllianceAuditLog.create.mockResolvedValue({});

      await service.markPaid(
        'payout-1',
        { paid_at: '2026-03-15' },
        mockAdminUser,
      );

      expect(txMock.affiliatePayoutRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paid_at: new Date('2026-03-15'),
          }),
        }),
      );
    });

    it('should write audit log entries for payout request and each commission', async () => {
      mockPrisma.affiliatePayoutRequest.findUnique
        .mockResolvedValueOnce({
          ...makePayoutRequest({ status: 'approved' }),
          commissions: [{ commission_id: 'commission-1' }],
        })
        .mockResolvedValueOnce(makePayoutRequest({ status: 'paid' }));

      const txMock = {
        affiliatePayoutRequest: { update: jest.fn().mockResolvedValue({}) },
        affiliateCommission: { updateMany: jest.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(txMock));
      mockPrisma.medAllianceAuditLog.create.mockResolvedValue({});

      await service.markPaid('payout-1', {}, mockAdminUser);

      // 1 for payout request + 1 per commission
      expect(mockPrisma.medAllianceAuditLog.create).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  // getAuditLog
  // -------------------------------------------------------------------------
  describe('getAuditLog', () => {
    it('should throw NotFoundException when payout request does not exist', async () => {
      mockPrisma.affiliatePayoutRequest.findUnique.mockResolvedValue(null);

      await expect(service.getAuditLog('payout-99')).rejects.toThrow(
        new NotFoundException('Payout request not found'),
      );
    });

    it('should return audit entries ordered chronologically', async () => {
      mockPrisma.affiliatePayoutRequest.findUnique.mockResolvedValue({ id: 'payout-1' });

      const entries = [
        { id: 'log-1', event: 'status_changed', old_status: null, new_status: 'requested', source: 'user', createdAt: new Date('2026-03-01'), actorUser: { id: 'affiliate-1', first_name: 'Jane', last_name: 'Affiliate' } },
        { id: 'log-2', event: 'admin_decision', old_status: 'requested', new_status: 'approved', source: 'admin_action', createdAt: new Date('2026-03-02'), actorUser: { id: 'admin-1', first_name: 'Admin', last_name: 'User' } },
      ];
      mockPrisma.medAllianceAuditLog.findMany.mockResolvedValue(entries);

      const result = await service.getAuditLog('payout-1');

      expect(result).toHaveLength(2);
      expect(result[0].new_status).toBe('requested');
      expect(result[1].new_status).toBe('approved');
      expect(mockPrisma.medAllianceAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { entity_type: 'payout_request', entity_id: 'payout-1' },
          orderBy: { createdAt: 'asc' },
        }),
      );
    });
  });
});
