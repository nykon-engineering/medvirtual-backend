import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { HubspotMatchingService } from './hubspot-matching.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { EligibilityCheckService } from '../referred-companies/eligibility-check.service';
import { ReviewCasesService } from '../review-cases/review-cases.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockPrisma = {
  organization: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const mockMailService = { sendMail: jest.fn() };
const mockEligibilityCheck = { runAndPersist: jest.fn() };
const mockReviewCases = { openOrSkip: jest.fn() };

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const makeOrg = (overrides: Partial<any> = {}) => ({
  id: 'org-1',
  name: 'Acme Corp',
  email: 'contact@acme.com',
  website_url: 'https://acme.com',
  hubspot_id: null,
  referred_by_affiliate_id: 'user-1',
  referredByAffiliate: { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' },
  ...overrides,
});

const hubspotSearchResponse = (results: Array<{ id: string }>) => ({
  data: { results },
});

describe('HubspotMatchingService', () => {
  let service: HubspotMatchingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HubspotMatchingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MailService, useValue: mockMailService },
        { provide: EligibilityCheckService, useValue: mockEligibilityCheck },
        { provide: ReviewCasesService, useValue: mockReviewCases },
      ],
    }).compile();

    service = module.get<HubspotMatchingService>(HubspotMatchingService);
  });

  afterEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------
  // already_matched
  // -------------------------------------------------------------------------
  describe('already matched', () => {
    it('should return already_matched and skip HubSpot call when hubspot_id is set', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(makeOrg({ hubspot_id: 'hs-existing' }));

      const result = await service.run('org-1');

      expect(result.outcome).toBe('already_matched');
      expect(result.hubspotCompanyId).toBe('hs-existing');
      expect(mockedAxios.post).not.toHaveBeenCalled();
      expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // org not found
  // -------------------------------------------------------------------------
  it('should return error when organization does not exist', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null);

    const result = await service.run('non-existent');

    expect(result.outcome).toBe('error');
    expect(result.error).toBe('Organization not found');
  });

  // -------------------------------------------------------------------------
  // no_match
  // -------------------------------------------------------------------------
  describe('no_match', () => {
    it('should set hubspot_sync_status=no_match when HubSpot returns 0 results', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(makeOrg());
      mockedAxios.post.mockResolvedValue(hubspotSearchResponse([]));
      mockPrisma.organization.update.mockResolvedValue({});

      const result = await service.run('org-1');

      expect(result.outcome).toBe('no_match');
      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ hubspot_sync_status: 'no_match' }),
        }),
      );
      expect(mockEligibilityCheck.runAndPersist).not.toHaveBeenCalled();
    });

    it('should return no_match when org has no name, email, or website_url', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(
        makeOrg({ name: '', email: null, website_url: null }),
      );
      mockPrisma.organization.update.mockResolvedValue({});

      const result = await service.run('org-1');

      // No filters built → no HubSpot call → no_match
      expect(result.outcome).toBe('no_match');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // synced (1 match)
  // -------------------------------------------------------------------------
  describe('synced — single match', () => {
    it('should store hubspot_id and re-run MA-004 when exactly 1 match is found', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(makeOrg());
      mockedAxios.post.mockResolvedValue(hubspotSearchResponse([{ id: 'hs-company-1' }]));
      mockPrisma.organization.update.mockResolvedValue({});
      mockEligibilityCheck.runAndPersist.mockResolvedValue({});

      const result = await service.run('org-1');

      expect(result.outcome).toBe('synced');
      expect(result.hubspotCompanyId).toBe('hs-company-1');

      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hubspot_id: 'hs-company-1',
            hubspot_sync_status: 'synced',
            hubspot_sync_error: null,
          }),
        }),
      );

      // MA-004 must be re-run after hubspot_id is set
      expect(mockEligibilityCheck.runAndPersist).toHaveBeenCalledWith('org-1', 'system', 'sync');
    });

    it('should include domain from website_url in HubSpot search filters', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(
        makeOrg({ website_url: 'https://www.acme.com' }),
      );
      mockedAxios.post.mockResolvedValue(hubspotSearchResponse([{ id: 'hs-1' }]));
      mockPrisma.organization.update.mockResolvedValue({});
      mockEligibilityCheck.runAndPersist.mockResolvedValue({});

      await service.run('org-1');

      const payload = mockedAxios.post.mock.calls[0][1] as any;
      const domainFilter = payload.filterGroups.find((g: any) =>
        g.filters.some(
          (f: any) => f.propertyName === 'domain' && f.value === 'acme.com',
        ),
      );
      expect(domainFilter).toBeDefined();
    });

    it('should include email domain as a fallback filter', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(
        makeOrg({ website_url: null, email: 'info@globalcorp.com' }),
      );
      mockedAxios.post.mockResolvedValue(hubspotSearchResponse([{ id: 'hs-2' }]));
      mockPrisma.organization.update.mockResolvedValue({});
      mockEligibilityCheck.runAndPersist.mockResolvedValue({});

      await service.run('org-1');

      const payload = mockedAxios.post.mock.calls[0][1] as any;
      const emailDomainFilter = payload.filterGroups.find((g: any) =>
        g.filters.some(
          (f: any) => f.propertyName === 'domain' && f.value === 'globalcorp.com',
        ),
      );
      expect(emailDomainFilter).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // multiple_matches
  // -------------------------------------------------------------------------
  describe('multiple_matches', () => {
    it('should set not_eligible and send email when 2+ matches are found', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(makeOrg());
      mockedAxios.post.mockResolvedValue(
        hubspotSearchResponse([{ id: 'hs-1' }, { id: 'hs-2' }]),
      );
      mockPrisma.organization.update.mockResolvedValue({});
      mockMailService.sendMail.mockResolvedValue(true);

      const result = await service.run('org-1');

      expect(result.outcome).toBe('multiple_matches');

      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            med_alliance_referral_status: 'not_eligible',
            hubspot_sync_status: 'multiple_matches',
          }),
        }),
      );

      expect(mockMailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'paulo@regenta.ai',
          subject: expect.stringContaining('Multiple HubSpot Matches'),
        }),
      );

      // MA-004 must NOT be re-run — pipeline is halted
      expect(mockEligibilityCheck.runAndPersist).not.toHaveBeenCalled();
    });

    it('should include org name and affiliate info in the admin notification email', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(makeOrg());
      mockedAxios.post.mockResolvedValue(
        hubspotSearchResponse([{ id: 'hs-1' }, { id: 'hs-2' }]),
      );
      mockPrisma.organization.update.mockResolvedValue({});
      mockMailService.sendMail.mockResolvedValue(true);

      await service.run('org-1');

      const emailCall = mockMailService.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain('Acme Corp');
      expect(emailCall.html).toContain('org-1');
      expect(emailCall.html).toContain('Jane Doe');
    });
  });

  // -------------------------------------------------------------------------
  // error handling
  // -------------------------------------------------------------------------
  describe('error handling', () => {
    it('should set hubspot_sync_status=error and return error outcome on HubSpot API failure', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(makeOrg());
      mockedAxios.post.mockRejectedValue(new Error('HubSpot API timeout'));
      mockPrisma.organization.update.mockResolvedValue({});

      const result = await service.run('org-1');

      expect(result.outcome).toBe('error');
      expect(result.error).toBe('HubSpot API timeout');

      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hubspot_sync_status: 'error',
            hubspot_sync_error: 'HubSpot API timeout',
          }),
        }),
      );
    });

    it('should not re-run MA-004 on error', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(makeOrg());
      mockedAxios.post.mockRejectedValue(new Error('network error'));
      mockPrisma.organization.update.mockResolvedValue({});

      await service.run('org-1');

      expect(mockEligibilityCheck.runAndPersist).not.toHaveBeenCalled();
    });
  });
});
