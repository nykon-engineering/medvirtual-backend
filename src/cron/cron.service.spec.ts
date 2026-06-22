import { Test, TestingModule } from '@nestjs/testing';
import { CronService } from './cron.service';
import { PrismaService } from '../prisma/prisma.service';
import { CandidatesService } from '../candidate/candidates.service';
import { reRunPipelineDto } from './dto/re-run-pipeline.dto';
import { HandlerObjectCreation } from '../hubspot/handlers/objectCreation';
import { MailService } from '../mail/mail.service';
import { HireRequestService } from '../hire-request/hire-request.service';
import { PositionRateConfigService } from '../position-rate-config/position-rate-config.service';
import { PayoutRequestsService } from '../med-alliance/payout-requests/payout-requests.service';
import { ReferralSyncService } from '../med-alliance/sync/referral-sync.service';
import { CommissionDetectionService } from '../med-alliance/sync/commission-detection.service';
import { AllianceNotificationsService } from '../med-alliance/notifications/notifications.service';

jest.mock('axios');

describe.skip('CronService', () => {
  let service: CronService;
  let prismaServiceMock: any;
  let candidatesServiceMock: { processData: jest.Mock };
  let handlerObjectCreationMock: { execute: jest.Mock };
  let mailServiceMock: { sendMail: jest.Mock };
  let hireRequestServiceMock: Record<string, jest.Mock>;
  let positionRateConfigServiceMock: Record<string, jest.Mock>;
  let payoutRequestsServiceMock: Record<string, jest.Mock>;
  let referralSyncServiceMock: { run: jest.Mock };
  let commissionDetectionServiceMock: { run: jest.Mock };
  let allianceNotificationsMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    prismaServiceMock = {
      candidate: {
        findMany: jest.fn(),
      },
      positionRateConfig: {
        create: jest.fn(),
      },
      organization: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      affiliateCommission: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      medAllianceAuditLog: {
        create: jest.fn(),
      },
    };

    candidatesServiceMock = {
      processData: jest.fn(),
    };

    handlerObjectCreationMock = {
      execute: jest.fn(),
    };

    mailServiceMock = {
      sendMail: jest.fn(),
    };

    hireRequestServiceMock = {
      findAll: jest.fn(),
      getVATypes: jest.fn(),
    };

    positionRateConfigServiceMock = {
      findAll: jest.fn().mockResolvedValue({ status: 200, data: [], meta: { total: 0, page: 1, perPage: 10, totalPages: 0 } }),
      findAllUnpaginated: jest.fn().mockResolvedValue([]),
    };

    payoutRequestsServiceMock = {
      createFromCron: jest.fn(),
    };

    referralSyncServiceMock = {
      run: jest.fn(),
    };

    commissionDetectionServiceMock = {
      run: jest.fn(),
    };

    allianceNotificationsMock = {
      notifyCommissionEligible: jest.fn(),
      notifyAdminCommissionReverted: jest.fn(),
      notifyAdminCommissionPendingSummary: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CronService,
        { provide: PrismaService, useValue: prismaServiceMock },
        { provide: CandidatesService, useValue: candidatesServiceMock },
        { provide: HandlerObjectCreation, useValue: handlerObjectCreationMock },
        { provide: MailService, useValue: mailServiceMock },
        { provide: HireRequestService, useValue: hireRequestServiceMock },
        { provide: PositionRateConfigService, useValue: positionRateConfigServiceMock },
        { provide: PayoutRequestsService, useValue: payoutRequestsServiceMock },
        { provide: ReferralSyncService, useValue: referralSyncServiceMock },
        { provide: CommissionDetectionService, useValue: commissionDetectionServiceMock },
        { provide: AllianceNotificationsService, useValue: allianceNotificationsMock },
      ],
    }).compile();

    service = module.get<CronService>(CronService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('syncPositionsFromHubspot', () => {
    it('returns true and does nothing when no new positions found', async () => {
      hireRequestServiceMock.getVATypes.mockResolvedValue([
        { label: 'Admin VA' },
        { label: 'Billing VA' },
      ]);
      positionRateConfigServiceMock.findAllUnpaginated.mockResolvedValue([
        { position: 'Admin VA' },
        { position: 'Billing VA' },
      ]);

      const result = await service.syncPositionsFromHubspot();

      expect(result).toBe(true);
      expect(prismaServiceMock.positionRateConfig.create).not.toHaveBeenCalled();
      expect(mailServiceMock.sendMail).not.toHaveBeenCalled();
    });

    it('creates new positions and sends alert email when new positions exist', async () => {
      hireRequestServiceMock.getVATypes.mockResolvedValue([
        { label: 'Admin VA' },
        { label: 'Billing VA' },
        { label: 'New Position' },
      ]);
      positionRateConfigServiceMock.findAllUnpaginated.mockResolvedValue([
        { position: 'Admin VA' },
        { position: 'Billing VA' },
      ]);
      prismaServiceMock.positionRateConfig.create.mockResolvedValue({});
      mailServiceMock.sendMail.mockResolvedValue({});

      const result = await service.syncPositionsFromHubspot();

      expect(result).toBe(true);
      expect(prismaServiceMock.positionRateConfig.create).toHaveBeenCalledWith({
        data: { position: 'New Position',
                medVirtual_margin_per_hour: 9,
                berryVirtual_margin_per_hour: 9,
         },
      });
      expect(mailServiceMock.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '[Action Required] New VA Positions Found',
        }),
      );
    });

    it('returns false when an error occurs', async () => {
      hireRequestServiceMock.getVATypes.mockRejectedValue(new Error('HubSpot API error'));

      const result = await service.syncPositionsFromHubspot();

      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // promoteDeployedCompanies
  // -------------------------------------------------------------------------
  describe('promoteDeployedCompanies', () => {
    it('should return zero counts when no orgs qualify', async () => {
      prismaServiceMock.organization.findMany.mockResolvedValue([]);

      const result = await service.promoteDeployedCompanies();

      expect(result).toEqual({ companiesPromoted: 0, commissionsPromoted: 0, errors: [] });
      expect(prismaServiceMock.organization.update).not.toHaveBeenCalled();
      expect(prismaServiceMock.affiliateCommission.findMany).not.toHaveBeenCalled();
    });

    it('should promote eligible orgs and their detected commissions', async () => {
      const deployedAt = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000); // 40 days ago
      prismaServiceMock.organization.findMany.mockResolvedValue([
        { id: 'org-1', eligibility_start_at: deployedAt },
        { id: 'org-2', eligibility_start_at: deployedAt },
      ]);
      prismaServiceMock.organization.update.mockResolvedValue({});
      prismaServiceMock.medAllianceAuditLog.create.mockResolvedValue({});
      prismaServiceMock.affiliateCommission.findMany
        .mockResolvedValueOnce([{ id: 'comm-1' }, { id: 'comm-2' }]) // 2 commissions for org-1
        .mockResolvedValueOnce([{ id: 'comm-3' }]);                   // 1 commission for org-2
      prismaServiceMock.affiliateCommission.update.mockResolvedValue({});

      const result = await service.promoteDeployedCompanies();

      expect(result.companiesPromoted).toBe(2);
      expect(result.commissionsPromoted).toBe(3);
      expect(result.errors).toHaveLength(0);
    });

    it('should set org status to eligible and clear block reason', async () => {
      const deployedAt = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      prismaServiceMock.organization.findMany.mockResolvedValue([
        { id: 'org-1', eligibility_start_at: deployedAt },
      ]);
      prismaServiceMock.organization.update.mockResolvedValue({});
      prismaServiceMock.medAllianceAuditLog.create.mockResolvedValue({});
      prismaServiceMock.affiliateCommission.findMany.mockResolvedValue([]);

      await service.promoteDeployedCompanies();

      expect(prismaServiceMock.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'org-1' },
          data: expect.objectContaining({
            med_alliance_referral_status: 'eligible',
            med_alliance_block_reason: null,
          }),
        }),
      );
    });

    it('should promote detected commissions to pending_admin_confirmation', async () => {
      const deployedAt = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      prismaServiceMock.organization.findMany.mockResolvedValue([
        { id: 'org-1', eligibility_start_at: deployedAt },
      ]);
      prismaServiceMock.organization.update.mockResolvedValue({});
      prismaServiceMock.medAllianceAuditLog.create.mockResolvedValue({});
      prismaServiceMock.affiliateCommission.findMany.mockResolvedValue([{ id: 'comm-1' }]);
      prismaServiceMock.affiliateCommission.update.mockResolvedValue({});

      await service.promoteDeployedCompanies();

      expect(prismaServiceMock.affiliateCommission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'comm-1' },
          data: { status: 'pending_admin_confirmation' },
        }),
      );
    });

    it('should write eligibility_activated audit log for each promoted org', async () => {
      const deployedAt = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      prismaServiceMock.organization.findMany.mockResolvedValue([
        { id: 'org-1', eligibility_start_at: deployedAt },
      ]);
      prismaServiceMock.organization.update.mockResolvedValue({});
      prismaServiceMock.medAllianceAuditLog.create.mockResolvedValue({});
      prismaServiceMock.affiliateCommission.findMany.mockResolvedValue([]);

      await service.promoteDeployedCompanies();

      expect(prismaServiceMock.medAllianceAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entity_type: 'referred_company',
            entity_id: 'org-1',
            event: 'eligibility_activated',
            old_status: 'not_eligible',
            new_status: 'eligible',
            reason: '30-day deployment window elapsed',
            source: 'cron',
            actor_user_id: null,
          }),
        }),
      );
    });

    it('should write status_changed audit log for each promoted commission', async () => {
      const deployedAt = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      prismaServiceMock.organization.findMany.mockResolvedValue([
        { id: 'org-1', eligibility_start_at: deployedAt },
      ]);
      prismaServiceMock.organization.update.mockResolvedValue({});
      prismaServiceMock.medAllianceAuditLog.create.mockResolvedValue({});
      prismaServiceMock.affiliateCommission.findMany.mockResolvedValue([{ id: 'comm-1' }]);
      prismaServiceMock.affiliateCommission.update.mockResolvedValue({});

      await service.promoteDeployedCompanies();

      expect(prismaServiceMock.medAllianceAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entity_type: 'commission',
            entity_id: 'comm-1',
            event: 'status_changed',
            old_status: 'detected',
            new_status: 'pending_admin_confirmation',
            source: 'cron',
          }),
        }),
      );
    });

    it('should skip orgs with no detected commissions without error', async () => {
      const deployedAt = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      prismaServiceMock.organization.findMany.mockResolvedValue([
        { id: 'org-1', eligibility_start_at: deployedAt },
      ]);
      prismaServiceMock.organization.update.mockResolvedValue({});
      prismaServiceMock.medAllianceAuditLog.create.mockResolvedValue({});
      prismaServiceMock.affiliateCommission.findMany.mockResolvedValue([]); // no detected commissions

      const result = await service.promoteDeployedCompanies();

      expect(result.companiesPromoted).toBe(1);
      expect(result.commissionsPromoted).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(prismaServiceMock.affiliateCommission.update).not.toHaveBeenCalled();
    });

    it('should catch per-org errors and continue processing remaining orgs', async () => {
      const deployedAt = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      prismaServiceMock.organization.findMany.mockResolvedValue([
        { id: 'org-fail', eligibility_start_at: deployedAt },
        { id: 'org-ok', eligibility_start_at: deployedAt },
      ]);
      prismaServiceMock.organization.update
        .mockRejectedValueOnce(new Error('DB timeout'))  // org-fail throws
        .mockResolvedValueOnce({});                       // org-ok succeeds
      prismaServiceMock.medAllianceAuditLog.create.mockResolvedValue({});
      prismaServiceMock.affiliateCommission.findMany.mockResolvedValue([]);

      const result = await service.promoteDeployedCompanies();

      expect(result.companiesPromoted).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('org-fail');
    });

    it('should query orgs with correct date window constraints', async () => {
      prismaServiceMock.organization.findMany.mockResolvedValue([]);

      await service.promoteDeployedCompanies();

      expect(prismaServiceMock.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            med_alliance_referral_status: 'not_eligible',
            referral_stage: 'deployed',
            OR: expect.arrayContaining([
              expect.objectContaining({
                deployment_date: expect.objectContaining({
                  lte: expect.any(Date),
                  gte: expect.any(Date),
                }),
              }),
              expect.objectContaining({
                deployment_date: null,
                first_paid_invoice_at: expect.objectContaining({
                  lte: expect.any(Date),
                  gte: expect.any(Date),
                }),
              }),
            ]),
          }),
        }),
      );
    });
  });

  /*
  it('should re-run pipeline for all candidates with given status', async () => {
    // Arrange: simula retorno do banco
    prismaServiceMock.candidate.findMany.mockResolvedValue([
      { id: 1, first_name: 'John', last_name: 'Doe' },
      { id: 2, first_name: 'Jane', last_name: 'Smith' },
    ]);

    candidatesServiceMock.processData.mockResolvedValue(undefined);

    const dto: reRunPipelineDto = {
      status: 'processing_uploadFile' as any, // cast para evitar reclamação do tipo
    };

    // Act
    const result = await service.reRunPipeline(dto);

    // Assert
    expect(prismaServiceMock.candidate.findMany).toHaveBeenCalledWith({
      where: { processing_status: dto.status },
      select: { id: true, first_name: true, last_name: true },
    });

    expect(candidatesServiceMock.processData).toHaveBeenCalledTimes(2);
    expect(candidatesServiceMock.processData).toHaveBeenNthCalledWith(1, 1);
    expect(candidatesServiceMock.processData).toHaveBeenNthCalledWith(2, 2);

    expect(result).toBe(true);
  });

  it('should return true even if no candidates are found', async () => {
    prismaServiceMock.candidate.findMany.mockResolvedValue([]);

    const dto: reRunPipelineDto = {
      status: 'processing_extractData' as any,
    };

    const result = await service.reRunPipeline(dto);

    expect(candidatesServiceMock.processData).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });

  */

  // ---------------------------------------------------------------------------
  // reRunPipeline
  // ---------------------------------------------------------------------------
  describe('reRunPipeline', () => {
    const dto: reRunPipelineDto = { status: 'processing_extractData' as any };

    it('should return true and not call processData when environment is not PROD', async () => {
      const originalEnv = process.env.ENVIRONMENT;
      process.env.ENVIRONMENT = 'DEV';

      prismaServiceMock.candidate.findMany.mockResolvedValue([
        { id: 'c-1', first_name: 'John', last_name: 'Doe' },
      ]);

      const result = await service.reRunPipeline(dto);

      expect(result).toBe(true);
      expect(candidatesServiceMock.processData).not.toHaveBeenCalled();

      process.env.ENVIRONMENT = originalEnv;
    });

    it('should process candidates in PROD and return true', async () => {
      const originalEnv = process.env.ENVIRONMENT;
      process.env.ENVIRONMENT = 'PROD';

      prismaServiceMock.candidate.findMany.mockResolvedValue([
        { id: 'c-1', first_name: 'Alice', last_name: 'Smith' },
        { id: 'c-2', first_name: 'Bob', last_name: 'Jones' },
      ]);
      candidatesServiceMock.processData.mockResolvedValue(undefined);

      const result = await service.reRunPipeline(dto);

      expect(result).toBe(true);
      expect(candidatesServiceMock.processData).toHaveBeenCalledTimes(2);
      expect(candidatesServiceMock.processData).toHaveBeenCalledWith('c-1');
      expect(candidatesServiceMock.processData).toHaveBeenCalledWith('c-2');

      process.env.ENVIRONMENT = originalEnv;
    });

    it('should mark candidate as failed and continue when processData throws in PROD', async () => {
      const originalEnv = process.env.ENVIRONMENT;
      process.env.ENVIRONMENT = 'PROD';

      prismaServiceMock.candidate = {
        ...prismaServiceMock.candidate,
        update: jest.fn().mockResolvedValue({}),
      };

      prismaServiceMock.candidate.findMany.mockResolvedValue([
        { id: 'c-bad', first_name: 'Fail', last_name: 'Candidate' },
        { id: 'c-good', first_name: 'OK', last_name: 'Candidate' },
      ]);
      candidatesServiceMock.processData
        .mockRejectedValueOnce(new Error('pipeline error'))
        .mockResolvedValueOnce(undefined);

      const result = await service.reRunPipeline(dto);

      expect(result).toBe(true);
      expect(prismaServiceMock.candidate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c-bad' },
          data: { processing_status: 'failed' },
        }),
      );

      process.env.ENVIRONMENT = originalEnv;
    });

    it('should query with NOT completed when status is "failed"', async () => {
      prismaServiceMock.candidate.findMany.mockResolvedValue([]);

      await service.reRunPipeline({ status: 'failed' as any });

      expect(prismaServiceMock.candidate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            processing_status: { not: 'completed' },
          }),
        }),
      );
    });

    it('should return true when no candidates are found', async () => {
      prismaServiceMock.candidate.findMany.mockResolvedValue([]);

      const result = await service.reRunPipeline(dto);

      expect(result).toBe(true);
      expect(candidatesServiceMock.processData).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // systemReport
  // ---------------------------------------------------------------------------
  describe('systemReport', () => {
    beforeEach(() => {
      prismaServiceMock.candidate = {
        ...prismaServiceMock.candidate,
        count: jest.fn(),
      };
    });

    it('should return true and send system report email on success', async () => {
      prismaServiceMock.candidate.count
        .mockResolvedValueOnce(10) // availableCandidates
        .mockResolvedValueOnce(5)  // endorsedCandidates
        .mockResolvedValueOnce(3); // withoutResume
      prismaServiceMock.candidate.findMany
        .mockResolvedValueOnce([{ id: 'c-1', first_name: 'A', last_name: 'B', name: 'AB', hubspot_id: 'hs-1', processing_error: null }]) // failedResumeParsing
        .mockResolvedValueOnce([{ id: 'c-2', first_name: 'C', last_name: 'D', name: 'CD', hubspot_id: 'hs-2' }]); // withoutHeadshot
      mailServiceMock.sendMail.mockResolvedValue(true);

      const result = await service.systemReport();

      expect(result).toBe(true);
      expect(mailServiceMock.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'System Report' }),
      );
    });

    it('should return true even when mailSent is falsy', async () => {
      prismaServiceMock.candidate.count.mockResolvedValue(0);
      prismaServiceMock.candidate.findMany.mockResolvedValue([]);
      mailServiceMock.sendMail.mockResolvedValue(null);

      const result = await service.systemReport();

      expect(result).toBe(true);
    });

    it('should return false when an error is thrown', async () => {
      prismaServiceMock.candidate.count.mockRejectedValue(new Error('DB error'));

      const result = await service.systemReport();

      expect(result).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // syncClientsWithActiveStaffs
  // ---------------------------------------------------------------------------
  describe('syncClientsWithActiveStaffs', () => {
    it('should update inactive clients that have active staffs to active', async () => {
      prismaServiceMock.organization.findMany.mockResolvedValue([
        { id: 'org-1', name: 'Clinic A', staff: [{ id: 's-1', hubspot_id: 'hs-1', hub_deal_name: 'deal', hubspot_dealstage: '16981840' }] },
      ]);
      prismaServiceMock.organization.update.mockResolvedValue({});

      const result = await service.syncClientsWithActiveStaffs();

      expect(result).toBe(true);
      expect(prismaServiceMock.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'org-1' },
          data: { status: 'active' },
        }),
      );
    });

    it('should return true when no inactive clients have active staffs', async () => {
      prismaServiceMock.organization.findMany.mockResolvedValue([]);

      const result = await service.syncClientsWithActiveStaffs();

      expect(result).toBe(true);
      expect(prismaServiceMock.organization.update).not.toHaveBeenCalled();
    });

    it('should return false when an error is thrown', async () => {
      prismaServiceMock.organization.findMany.mockRejectedValue(new Error('DB failure'));

      const result = await service.syncClientsWithActiveStaffs();

      expect(result).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // deactivateClientUsersWithNoStaff
  // ---------------------------------------------------------------------------
  describe('deactivateClientUsersWithNoStaff', () => {
    beforeEach(() => {
      prismaServiceMock.uSER = {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      };
      prismaServiceMock.$transaction = jest.fn();
    });

    it('should return true immediately when no clients have no staff', async () => {
      prismaServiceMock.organization.findMany.mockResolvedValue([]);

      const result = await service.deactivateClientUsersWithNoStaff();

      expect(result).toBe(true);
      expect(prismaServiceMock.uSER.findMany).not.toHaveBeenCalled();
    });

    it('should deactivate active users and delete invited users, then send report', async () => {
      prismaServiceMock.organization.findMany.mockResolvedValue([
        { id: 'org-1', name: 'Clinic A' },
      ]);
      prismaServiceMock.uSER.findMany
        .mockResolvedValueOnce([
          { id: 'u-active', email: 'active@test.com', first_name: 'Active', last_name: 'User', organization_id: 'org-1' },
        ])
        .mockResolvedValueOnce([
          { id: 'u-invited', email: 'invited@test.com', first_name: 'Invited', last_name: 'User', organization_id: 'org-1' },
        ]);
      prismaServiceMock.uSER.updateMany = jest.fn().mockResolvedValue({});

      const txMock = {
        emailVerification: { deleteMany: jest.fn().mockResolvedValue({}) },
        emailInvitation: { deleteMany: jest.fn().mockResolvedValue({}) },
        uSER: { delete: jest.fn().mockResolvedValue({}) },
      };
      prismaServiceMock.$transaction.mockImplementation(async (fn: any) => fn(txMock));
      mailServiceMock.sendMail.mockResolvedValue(true);

      const result = await service.deactivateClientUsersWithNoStaff();

      expect(result).toBe(true);
      expect(prismaServiceMock.uSER.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'inactive', status_before_deactivation: 'active' },
        }),
      );
      expect(txMock.uSER.delete).toHaveBeenCalledWith({ where: { id: 'u-invited' } });
      expect(mailServiceMock.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'Client Users Deactivation Report' }),
      );
    });

    it('should handle no active or invited users gracefully and send report', async () => {
      prismaServiceMock.organization.findMany.mockResolvedValue([
        { id: 'org-1', name: 'Clinic A' },
      ]);
      prismaServiceMock.uSER.findMany
        .mockResolvedValueOnce([]) // no active users
        .mockResolvedValueOnce([]); // no invited users
      prismaServiceMock.uSER.updateMany = jest.fn().mockResolvedValue({});
      mailServiceMock.sendMail.mockResolvedValue(true);

      const result = await service.deactivateClientUsersWithNoStaff();

      expect(result).toBe(true);
      expect(prismaServiceMock.$transaction).not.toHaveBeenCalled();
    });

    it('should return false and send error email when an error is thrown', async () => {
      prismaServiceMock.organization.findMany.mockRejectedValue(new Error('DB down'));
      mailServiceMock.sendMail.mockResolvedValue(true);

      const result = await service.deactivateClientUsersWithNoStaff();

      expect(result).toBe(false);
      expect(mailServiceMock.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ subject: '[ERROR] Client Users Deactivation Cron Job Failed' }),
      );
    });

    it('should return false and swallow mail error when both main and mail throw', async () => {
      prismaServiceMock.organization.findMany.mockRejectedValue(new Error('DB down'));
      mailServiceMock.sendMail.mockRejectedValue(new Error('mail error'));

      const result = await service.deactivateClientUsersWithNoStaff();

      expect(result).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // syncStaffHubspotDealStages
  // ---------------------------------------------------------------------------
  describe('syncStaffHubspotDealStages', () => {
    let axiosMock: jest.Mocked<typeof import('axios').default>;

    beforeEach(() => {
      prismaServiceMock.staff = {
        findMany: jest.fn(),
        update: jest.fn(),
      };
      axiosMock = jest.requireMock('axios');
      axiosMock.get = jest.fn();
    });

    it('should return true when no staffs match criteria', async () => {
      prismaServiceMock.staff.findMany.mockResolvedValue([]);

      const result = await service.syncStaffHubspotDealStages();

      expect(result).toBe(true);
      expect(prismaServiceMock.staff.update).not.toHaveBeenCalled();
    });

    it('should update staff dealstage for each staff and return true', async () => {
      prismaServiceMock.staff.findMany.mockResolvedValue([
        { id: 's-1', hubspot_id: 'hs-100' },
        { id: 's-2', hubspot_id: 'hs-200' },
      ]);
      prismaServiceMock.staff.update.mockResolvedValue({});
      axiosMock.get.mockResolvedValue({
        data: { properties: { dealstage: '16981840' } },
      });

      const result = await service.syncStaffHubspotDealStages();

      expect(result).toBe(true);
      expect(prismaServiceMock.staff.update).toHaveBeenCalledTimes(2);
      expect(prismaServiceMock.staff.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 's-1' },
          data: expect.objectContaining({ hubspot_dealstage: '16981840' }),
        }),
      );
    });

    it('should continue processing remaining staffs when one axios call fails', async () => {
      prismaServiceMock.staff.findMany.mockResolvedValue([
        { id: 's-fail', hubspot_id: 'hs-bad' },
        { id: 's-ok', hubspot_id: 'hs-good' },
      ]);
      prismaServiceMock.staff.update.mockResolvedValue({});
      axiosMock.get
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce({ data: { properties: { dealstage: '148234581' } } }); // inactive stage

      const result = await service.syncStaffHubspotDealStages();

      expect(result).toBe(true);
      expect(prismaServiceMock.staff.update).toHaveBeenCalledTimes(1);
      expect(prismaServiceMock.staff.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 's-ok' },
          data: expect.objectContaining({ status: 'inactive' }),
        }),
      );
    });

    it('should return false when prisma.staff.findMany throws', async () => {
      prismaServiceMock.staff.findMany.mockRejectedValue(new Error('DB down'));

      const result = await service.syncStaffHubspotDealStages();

      expect(result).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // getCandidateId
  // ---------------------------------------------------------------------------
  describe('getCandidateId', () => {
    let axiosMock: jest.Mocked<typeof import('axios').default>;

    beforeEach(() => {
      prismaServiceMock.staff = {
        findMany: jest.fn(),
        update: jest.fn(),
      };
      prismaServiceMock.sync = {
        create: jest.fn().mockResolvedValue({}),
      };
      prismaServiceMock.candidate = {
        ...prismaServiceMock.candidate,
        findUnique: jest.fn(),
      };
      axiosMock = jest.requireMock('axios');
      axiosMock.get = jest.fn();
    });

    it('should return true and create a sync record when no staffs need updating', async () => {
      prismaServiceMock.staff.findMany.mockResolvedValue([]);

      const result = await service.getCandidateId();

      expect(result).toBe(true);
      expect(prismaServiceMock.sync.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ role: 'get-candidate-id' }) }),
      );
    });

    it('should link existing candidate to staff when candidate already exists in DB', async () => {
      prismaServiceMock.staff.findMany.mockResolvedValue([
        { id: 's-1', hubspot_id: 'deal-123' },
      ]);
      prismaServiceMock.staff.update.mockResolvedValue({});
      prismaServiceMock.candidate.findUnique.mockResolvedValue({ id: 'cand-99' });
      axiosMock.get.mockResolvedValue({
        data: { results: [{ id: 'hs-obj-1' }] },
      });

      const result = await service.getCandidateId();

      expect(result).toBe(true);
      expect(prismaServiceMock.staff.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 's-1' },
          data: expect.objectContaining({ candidate_id: 'cand-99' }),
        }),
      );
      expect(handlerObjectCreationMock.execute).not.toHaveBeenCalled();
    });

    it('should call objectCreation.execute when candidate does not exist and then re-query', async () => {
      prismaServiceMock.staff.findMany.mockResolvedValue([
        { id: 's-1', hubspot_id: 'deal-123' },
      ]);
      prismaServiceMock.staff.update.mockResolvedValue({});
      prismaServiceMock.candidate.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'cand-new' });
      handlerObjectCreationMock.execute.mockResolvedValue(undefined);
      axiosMock.get.mockResolvedValue({
        data: { results: [{ id: 'hs-obj-1' }] },
      });

      const result = await service.getCandidateId();

      expect(result).toBe(true);
      expect(handlerObjectCreationMock.execute).toHaveBeenCalledWith(
        expect.objectContaining({ objectId: 'hs-obj-1' }),
      );
      expect(prismaServiceMock.staff.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ candidate_id: 'cand-new' }),
        }),
      );
    });

    it('should set candidate_id to null when staff has no associated VA object', async () => {
      prismaServiceMock.staff.findMany.mockResolvedValue([
        { id: 's-1', hubspot_id: 'deal-123' },
      ]);
      axiosMock.get.mockResolvedValue({
        data: { results: [] },
      });

      const result = await service.getCandidateId();

      expect(result).toBe(true);
      expect(prismaServiceMock.staff.update).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // createQuarterlyPayoutRequests
  // ---------------------------------------------------------------------------
  describe('createQuarterlyPayoutRequests', () => {
    beforeEach(() => {
      prismaServiceMock.affiliateProfile = {
        findMany: jest.fn(),
      };
    });

    it('should return created=0 and failed=0 when no affiliates have eligible commissions', async () => {
      prismaServiceMock.affiliateProfile.findMany.mockResolvedValue([]);
      mailServiceMock.sendMail.mockResolvedValue(true);

      const result = await service.createQuarterlyPayoutRequests();

      expect(result).toEqual({ created: 0, failed: 0, total_amount: '0.00' });
      expect(mailServiceMock.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ subject: expect.stringContaining('Quarterly Payout Report') }),
      );
    });

    it('should create payout requests for each affiliate and report successes', async () => {
      prismaServiceMock.affiliateProfile.findMany.mockResolvedValue([
        {
          id: 'aff-1',
          full_name: 'Affiliate One',
          user: { email: 'aff1@test.com', first_name: 'Aff', last_name: 'One' },
          commissions: [
            { id: 'comm-1', commission_amount: 100 },
            { id: 'comm-2', commission_amount: 200 },
          ],
        },
      ]);
      payoutRequestsServiceMock.createFromCron.mockResolvedValue({
        id: 'payout-req-1',
        requested_amount: 300,
      });
      mailServiceMock.sendMail.mockResolvedValue(true);

      const result = await service.createQuarterlyPayoutRequests();

      expect(result.created).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.total_amount).toBe('300.00');
      expect(payoutRequestsServiceMock.createFromCron).toHaveBeenCalledWith('aff-1', ['comm-1', 'comm-2']);
    });

    it('should record failures when createFromCron throws and still send report', async () => {
      prismaServiceMock.affiliateProfile.findMany.mockResolvedValue([
        {
          id: 'aff-2',
          full_name: null,
          user: { email: 'aff2@test.com', first_name: 'Fail', last_name: 'Aff' },
          commissions: [{ id: 'comm-3', commission_amount: 50 }],
        },
      ]);
      payoutRequestsServiceMock.createFromCron.mockRejectedValue(new Error('payout error'));
      mailServiceMock.sendMail.mockResolvedValue(true);

      const result = await service.createQuarterlyPayoutRequests();

      expect(result.created).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.total_amount).toBe('0.00');
      expect(mailServiceMock.sendMail).toHaveBeenCalled();
    });

    it('should derive affiliate name from user when full_name is null', async () => {
      prismaServiceMock.affiliateProfile.findMany.mockResolvedValue([
        {
          id: 'aff-3',
          full_name: null,
          user: { email: 'aff3@test.com', first_name: 'Jane', last_name: 'Smith' },
          commissions: [{ id: 'comm-4', commission_amount: 75 }],
        },
      ]);
      payoutRequestsServiceMock.createFromCron.mockResolvedValue({ id: 'pr-2', requested_amount: 75 });
      mailServiceMock.sendMail.mockResolvedValue(true);

      const result = await service.createQuarterlyPayoutRequests();

      expect(result.created).toBe(1);
      expect(result.total_amount).toBe('75.00');
    });

    it('should use affiliate id as name when full_name and user are both null', async () => {
      prismaServiceMock.affiliateProfile.findMany.mockResolvedValue([
        {
          id: 'aff-4',
          full_name: null,
          user: null,
          commissions: [{ id: 'comm-5', commission_amount: 25 }],
        },
      ]);
      payoutRequestsServiceMock.createFromCron.mockResolvedValue({ id: 'pr-3', requested_amount: 25 });
      mailServiceMock.sendMail.mockResolvedValue(true);

      const result = await service.createQuarterlyPayoutRequests();

      expect(result.created).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // promoteDeployedCompanies — mail error catch branch (line 689)
  // ---------------------------------------------------------------------------
  describe('promoteDeployedCompanies — mail error branch', () => {
    it('should swallow mail error when sendMail throws after companies are promoted', async () => {
      const deployedAt = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      prismaServiceMock.organization.findMany.mockResolvedValue([
        { id: 'org-1', name: 'Clinic', eligibility_start_at: deployedAt },
      ]);
      prismaServiceMock.organization.update.mockResolvedValue({});
      prismaServiceMock.medAllianceAuditLog.create.mockResolvedValue({});
      prismaServiceMock.affiliateCommission.findMany.mockResolvedValue([]);
      mailServiceMock.sendMail.mockRejectedValue(new Error('mail server down'));

      const result = await service.promoteDeployedCompanies();

      expect(result.companiesPromoted).toBe(1);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // syncOrganizationsWithHubspot
  // ---------------------------------------------------------------------------
  describe('syncOrganizationsWithHubspot', () => {
    beforeEach(() => {
      prismaServiceMock.affiliateCommission = {
        ...prismaServiceMock.affiliateCommission,
        findMany: jest.fn(),
        update: jest.fn(),
      };
      prismaServiceMock.medAllianceAuditLog = {
        create: jest.fn(),
      };
    });

    it('should process a single org when organization_id is provided', async () => {
      const syncResult = { organizationId: 'org-1', phaseA: { outcome: 'already_matched' } };
      referralSyncServiceMock.run.mockResolvedValue(syncResult);
      prismaServiceMock.organization.findMany.mockResolvedValue([]); // no orgs to promote

      const result = await service.syncOrganizationsWithHubspot('org-1');

      expect(referralSyncServiceMock.run).toHaveBeenCalledTimes(1);
      expect(referralSyncServiceMock.run).toHaveBeenCalledWith('org-1');
      expect(result.processed).toBe(1);
      expect(result.syncFailed).toBe(0);
      expect(result.syncResults).toHaveLength(1);
    });

    it('should query all referred orgs when no organization_id is given', async () => {
      prismaServiceMock.organization.findMany
        .mockResolvedValueOnce([{ id: 'org-a' }, { id: 'org-b' }]) // referred orgs
        .mockResolvedValueOnce([]); // no deployable orgs
      referralSyncServiceMock.run.mockResolvedValue({ organizationId: 'x', phaseA: { outcome: 'already_matched' } });

      const result = await service.syncOrganizationsWithHubspot();

      expect(referralSyncServiceMock.run).toHaveBeenCalledTimes(2);
      expect(result.processed).toBe(2);
    });

    it('should increment syncFailed and continue when referralSync.run throws', async () => {
      prismaServiceMock.organization.findMany
        .mockResolvedValueOnce([{ id: 'org-fail' }, { id: 'org-ok' }])
        .mockResolvedValueOnce([]);
      referralSyncServiceMock.run
        .mockRejectedValueOnce(new Error('hubspot down'))
        .mockResolvedValueOnce({ organizationId: 'org-ok', phaseA: { outcome: 'synced' } });

      const result = await service.syncOrganizationsWithHubspot();

      expect(result.syncFailed).toBe(1);
      expect(result.processed).toBe(2);
      expect(result.syncResults).toHaveLength(1);
    });

    it('should promote deployed orgs that passed the 30-day window and advance their commissions', async () => {
      const deployedAt = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      referralSyncServiceMock.run.mockResolvedValue({ organizationId: 'org-1', phaseA: { outcome: 'already_matched' } });

      // When organization_id is provided, orgIds is built directly — no findMany for referred orgs.
      // Only the deployed-orgs promotion query hits findMany.
      prismaServiceMock.organization.findMany.mockResolvedValueOnce([
        { id: 'org-1', name: 'Clinic', eligibility_start_at: deployedAt },
      ]);
      prismaServiceMock.organization.update.mockResolvedValue({});
      prismaServiceMock.medAllianceAuditLog.create.mockResolvedValue({});
      prismaServiceMock.affiliateCommission.findMany.mockResolvedValue([{ id: 'comm-1' }]);
      prismaServiceMock.affiliateCommission.update.mockResolvedValue({});

      const result = await service.syncOrganizationsWithHubspot('org-1');

      expect(result.companiesPromoted).toBe(1);
      expect(result.commissionsPromoted).toBe(1);
      expect(result.promotionErrors).toHaveLength(0);
      expect(prismaServiceMock.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'org-1' },
          data: expect.objectContaining({ med_alliance_referral_status: 'eligible' }),
        }),
      );
    });

    it('should return promotionErrors when a per-org promotion fails', async () => {
      const deployedAt = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      referralSyncServiceMock.run.mockResolvedValue({ organizationId: 'org-1', phaseA: { outcome: 'already_matched' } });

      prismaServiceMock.organization.findMany.mockResolvedValueOnce([
        { id: 'org-1', name: 'Clinic', eligibility_start_at: deployedAt },
      ]);
      prismaServiceMock.organization.update.mockRejectedValue(new Error('DB error'));
      prismaServiceMock.medAllianceAuditLog.create.mockResolvedValue({});

      const result = await service.syncOrganizationsWithHubspot('org-1');

      expect(result.promotionErrors).toHaveLength(1);
      expect(result.promotionErrors[0]).toContain('org-1');
    });

    it('should return zero promotion counts when no deployed orgs qualify', async () => {
      referralSyncServiceMock.run.mockResolvedValue({ organizationId: 'org-1', phaseA: { outcome: 'already_matched' } });
      prismaServiceMock.organization.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]); // no qualifying deployed orgs

      const result = await service.syncOrganizationsWithHubspot('org-1');

      expect(result.companiesPromoted).toBe(0);
      expect(result.commissionsPromoted).toBe(0);
    });
  });
});
