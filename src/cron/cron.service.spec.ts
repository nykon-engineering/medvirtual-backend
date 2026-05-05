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

describe('CronService', () => {
  let service: CronService;
  let prismaServiceMock: any;
  let candidatesServiceMock: { processData: jest.Mock };
  let handlerObjectCreationMock: { execute: jest.Mock };
  let mailServiceMock: { sendMail: jest.Mock };
  let hireRequestServiceMock: Record<string, jest.Mock>;
  let positionRateConfigServiceMock: Record<string, jest.Mock>;
  let payoutRequestsServiceMock: Record<string, jest.Mock>;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [CronService,
        {provide: PrismaService, useValue: prismaServiceMock},
        {provide: CandidatesService, useValue: candidatesServiceMock},
        {provide: HandlerObjectCreation, useValue: handlerObjectCreationMock},
        { provide: MailService, useValue: mailServiceMock },
        { provide: HireRequestService, useValue: hireRequestServiceMock },
        { provide: PositionRateConfigService, useValue: positionRateConfigServiceMock },
        { provide: PayoutRequestsService, useValue: payoutRequestsServiceMock },
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
            eligibility_start_at: expect.objectContaining({
              lte: expect.any(Date), // ≤ 30 days ago
              gte: expect.any(Date), // ≥ 1 year ago
            }),
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
});
