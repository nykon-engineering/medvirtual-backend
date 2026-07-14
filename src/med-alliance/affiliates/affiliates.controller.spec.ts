import { Test } from '@nestjs/testing';
import { AffiliatesController } from './affiliates.controller';
import { AffiliatesService } from './affiliates.service';
import { AuthGuard } from '../../auth/auth.guard';
import { RolesGuard } from '../../auth/roles.guard';

// ---------------------------------------------------------------------------
// This spec focuses on the `recent_commissions` mapping (BR-3): each item must
// expose the HubSpot invoice id (`invoice_id`) and human-readable invoice
// number (`name`) taken from the `hubspotInvoiceSnapshot` relation, while
// staying null-safe when that relation is absent.
// ---------------------------------------------------------------------------

const mockAffiliatesService = {
  findOneEnriched: jest.fn(),
};

function buildEnriched(commissions: any[]) {
  return {
    profile: {
      id: 'profile-1',
      user_id: 'user-1',
      full_name: 'John Doe',
      status: 'active',
      commission_percent_default: '10.00',
      payout_preference_method: 'ach',
      payout_preference_reference: null,
      payout_preference_notes: null,
      hubspot_id: null,
      hubspot_pipeline: null,
      hubspot_pipeline_stage: null,
      business_unit: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      contact: null,
      user: {
        id: 'user-1',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        role: 'affiliate',
        status: 'active',
        organization: null,
        referredOrganizations: [],
        contact: null,
      },
      commissions,
    },
    pendingAgg: { _sum: { requested_amount: 0 } },
    lifetimeAgg: { _sum: { commission_amount: 0 } },
    payoutHistory: [],
    commsByOrg: [],
    user: {
      id: 'user-1',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      role: 'affiliate',
      status: 'active',
    },
  };
}

describe('AffiliatesController', () => {
  let controller: AffiliatesController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      controllers: [AffiliatesController],
      providers: [
        { provide: AffiliatesService, useValue: mockAffiliatesService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AffiliatesController>(AffiliatesController);
  });

  describe('findOne — recent_commissions mapping', () => {
    it('should populate invoice_id and name from the hubspotInvoiceSnapshot relation', async () => {
      mockAffiliatesService.findOneEnriched.mockResolvedValue(
        buildEnriched([
          {
            id: 'comm-1',
            organization: { id: 'org-1', name: 'Acme Clinic' },
            commission_amount: '50.00',
            status: 'eligible',
            createdAt: new Date('2026-02-01T00:00:00.000Z'),
            hubspot_invoice_snapshot_id: 'snap-1',
            hubspotInvoiceSnapshot: {
              hubspot_id: 'INV-HS-999',
              invoice_number: 'INV-0001',
            },
          },
        ]),
      );

      const result = await controller.findOne('profile-1');

      expect(result.data.recent_commissions[0]).toEqual(
        expect.objectContaining({
          id: 'comm-1',
          organization_name: 'Acme Clinic',
          amount: 50,
          status: 'eligible',
          invoice_id: 'INV-HS-999',
          name: 'INV-0001',
        }),
      );
    });

    it('should fall back to null when the hubspotInvoiceSnapshot relation is absent', async () => {
      mockAffiliatesService.findOneEnriched.mockResolvedValue(
        buildEnriched([
          {
            id: 'comm-2',
            organization: { id: 'org-1', name: 'Acme Clinic' },
            commission_amount: '25.00',
            status: 'detected',
            createdAt: new Date('2026-02-02T00:00:00.000Z'),
            hubspot_invoice_snapshot_id: 'snap-2',
            // hubspotInvoiceSnapshot intentionally missing
          },
        ]),
      );

      const result = await controller.findOne('profile-1');

      expect(result.data.recent_commissions[0].invoice_id).toBeNull();
      expect(result.data.recent_commissions[0].name).toBeNull();
    });
  });
});
