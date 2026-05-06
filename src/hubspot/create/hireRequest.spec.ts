import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { HireRequestCreationService } from './hireRequest';
import { PrismaService } from '../../prisma/prisma.service';
import { HubspotAuditService } from '../hubspot-audit.service';
import { HubspotAuditAction, HubspotAuditSource, HubspotEntityType } from '@prisma/client';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const prismaMock = {
  uSER: { findUnique: jest.fn() },
  hireRequest: { update: jest.fn() },
};

const auditMock = { log: jest.fn() };

const baseData = {
  id: 'hr-uuid-001',
  title: 'VA Request',
  description: 'Need a VA',
  request_role: 'Nurse',
  availability: 'full-time',
  priority: 'high',
  hubspot_pairing_request_type: 'New Client',
  hubspot_role_type: 'RN',
  hubspot_contract_amount: 5000,
  hubspot_language: 'English',
  hubspot_numberVA: 1,
  salary_range_from: 20,
  salary_range_to: 30,
  organization: {
    name: 'Org Inc',
    hubspot_id: 'hs-company-123',
    website_url: 'https://org.com',
    business_unit: 'MedVirtual',
  },
};

describe('HireRequestCreationService', () => {
  let service: HireRequestCreationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HireRequestCreationService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: HubspotAuditService, useValue: auditMock },
      ],
    }).compile();

    service = module.get<HireRequestCreationService>(HireRequestCreationService);
  });

  // ── Success path ─────────────────────────────────────────────────────────────

  describe('execute() — success', () => {
    beforeEach(() => {
      mockedAxios.post.mockResolvedValueOnce({ data: { id: 'hs-ticket-999' } });
      prismaMock.hireRequest.update.mockResolvedValueOnce({});
    });

    it('returns true on successful creation', async () => {
      const result = await service.execute(baseData);
      expect(result).toBe(true);
    });

    it('persists the Hubspot ticket ID back to the DB', async () => {
      await service.execute(baseData);
      expect(prismaMock.hireRequest.update).toHaveBeenCalledWith({
        where: { id: 'hr-uuid-001' },
        data: { hubspot_ticket_id: 'hs-ticket-999' },
      });
    });

    it('logs CREATE audit with success=true', async () => {
      await service.execute(baseData, 'user-abc');

      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'user-abc',
          entityType: HubspotEntityType.hire_request,
          entityId: 'hr-uuid-001',
          hubspotObjectId: 'hs-ticket-999',
          hubspotObjectType: 'tickets',
          action: HubspotAuditAction.CREATE,
          success: true,
        }),
      );
    });

    it('sets source=user_action when actorUserId is present', async () => {
      await service.execute(baseData, 'user-abc');
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ source: HubspotAuditSource.user_action }),
      );
    });

    it('sets source=cron when actorUserId is absent', async () => {
      await service.execute(baseData);
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ source: HubspotAuditSource.cron }),
      );
    });

    it('includes organization hubspot_id in the audit payload', async () => {
      await service.execute(baseData, 'user-abc');
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ organizationId: 'hs-company-123' }),
        }),
      );
    });
  });

  // ── Failure path ─────────────────────────────────────────────────────────────

  describe('execute() — failure', () => {
    it('logs CREATE audit with success=false when Hubspot API returns HTTP error', async () => {
      const apiError = { response: { data: 'Bad request', status: 400 }, message: 'Request failed', code: undefined };
      mockedAxios.post.mockRejectedValueOnce(apiError);

      await service.execute(baseData, 'user-abc');

      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'user-abc',
          entityType: HubspotEntityType.hire_request,
          entityId: 'hr-uuid-001',
          hubspotObjectType: 'tickets',
          action: HubspotAuditAction.CREATE,
          success: false,
          errorCode: '400',
          errorMessage: 'Request failed',
        }),
      );
    });

    it('logs CREATE audit with success=false on network/connection error', async () => {
      const netError = { message: 'ECONNREFUSED', code: 'ECONNREFUSED' };
      mockedAxios.post.mockRejectedValueOnce(netError);

      await service.execute(baseData);

      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          errorCode: 'ECONNREFUSED',
          errorMessage: 'ECONNREFUSED',
        }),
      );
    });

    it('does not throw to the caller when Hubspot request fails', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('network error'));
      await expect(service.execute(baseData)).resolves.not.toThrow();
    });
  });
});
