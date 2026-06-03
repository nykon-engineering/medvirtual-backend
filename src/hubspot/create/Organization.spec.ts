import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { OrganizationCreationService } from './Organization';
import { PrismaService } from '../../prisma/prisma.service';
import { HubspotAuditService } from '../hubspot-audit.service';
import { HubspotAuditAction, HubspotAuditSource, HubspotEntityType } from '@prisma/client';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const prismaMock = {
  uSER: { findUnique: jest.fn() },
  affiliateProfile: { findUnique: jest.fn() },
  organization: { update: jest.fn() },
};
const auditMock = { log: jest.fn() };

const baseData = {
  id: 'org-uuid-001',
  name: 'Acme Hospital',
  description: 'A great hospital',
  address: '123 Main St',
  city: 'Miami',
  state: 'FL',
  postal_code: '33101',
  location: 'USA',
  website_url: 'https://acme.com',
  number_of_employees: 50,
  phone: '5551234567',
  email: 'contact@acme.com',
  type: 'Healthcare',
  business_unit: 'MedVirtual',
};

describe('OrganizationCreationService', () => {
  let service: OrganizationCreationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationCreationService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: HubspotAuditService, useValue: auditMock },
      ],
    }).compile();

    service = module.get<OrganizationCreationService>(OrganizationCreationService);
  });

  // ── Success path ─────────────────────────────────────────────────────────────

  describe('execute() — success', () => {
    beforeEach(() => {
      mockedAxios.post.mockResolvedValueOnce({ data: { id: 'hs-company-999' } });
      prismaMock.organization.update.mockResolvedValueOnce({});
    });

    it('returns true on success', async () => {
      const result = await service.execute(baseData, 'user-abc');
      expect(result).toBe(true);
    });

    it('saves hubspot_id to organization record', async () => {
      await service.execute(baseData, 'user-abc');
      expect(prismaMock.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-uuid-001' },
        data: { hubspot_id: 'hs-company-999' },
      });
    });

    it('logs CREATE with success=true and correct entity fields', async () => {
      await service.execute(baseData, 'user-abc');

      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'user-abc',
          entityType: HubspotEntityType.organization,
          entityId: 'org-uuid-001',
          hubspotObjectId: 'hs-company-999',
          hubspotObjectType: 'companies',
          action: HubspotAuditAction.CREATE,
          source: HubspotAuditSource.user_action,
          success: true,
          payload: { name: 'Acme Hospital' },
          response: { id: 'hs-company-999' },
        }),
      );
    });

    it('uses cron source when actorUserId is absent', async () => {
      await service.execute(baseData);

      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          source: HubspotAuditSource.cron,
          success: true,
        }),
      );
    });
  });

  // ── Failure path ──────────────────────────────────────────────────────────────

  describe('execute() — failure', () => {
    it('logs CREATE with success=false on HTTP error', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: { status: 422, data: {} },
        message: 'Unprocessable Entity',
      });

      await service.execute(baseData, 'user-abc');

      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: HubspotEntityType.organization,
          entityId: 'org-uuid-001',
          hubspotObjectType: 'companies',
          action: HubspotAuditAction.CREATE,
          source: HubspotAuditSource.user_action,
          success: false,
          errorCode: '422',
          errorMessage: 'Unprocessable Entity',
        }),
      );
    });

    it('logs success=false with error.code on network error', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        message: 'Network Error',
        code: 'ECONNRESET',
      });

      await service.execute(baseData);

      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          errorCode: 'ECONNRESET',
          errorMessage: 'Network Error',
        }),
      );
    });

    it('does not save hubspot_id when API fails', async () => {
      mockedAxios.post.mockRejectedValueOnce({ message: 'fail', code: 'ERR' });
      await service.execute(baseData);
      expect(prismaMock.organization.update).not.toHaveBeenCalled();
    });
  });

  // ── Source inference ──────────────────────────────────────────────────────────

  describe('source inference', () => {
    it('uses user_action when actorUserId provided', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { id: 'hs-1' } });
      prismaMock.organization.update.mockResolvedValueOnce({});
      await service.execute(baseData, 'user-123');

      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ source: HubspotAuditSource.user_action }),
      );
    });

    it('uses cron when actorUserId absent', async () => {
      mockedAxios.post.mockRejectedValueOnce({ message: 'err', code: 'ERR' });
      await service.execute(baseData);

      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ source: HubspotAuditSource.cron }),
      );
    });
  });
});
