import { Test, TestingModule } from '@nestjs/testing';
import { CronService } from './cron.service';
import { PrismaService } from '../prisma/prisma.service';
import { CandidatesService } from '../candidate/candidates.service';
import { reRunPipelineDto } from './dto/re-run-pipeline.dto';
import { HandlerObjectCreation } from '../hubspot/handlers/objectCreation';
import { MailService } from '../mail/mail.service';
import { HireRequestService } from '../hire-request/hire-request.service';
import { PositionRateConfigService } from '../position-rate-config/position-rate-config.service';

describe('CronService', () => {
  let service: CronService;
  let prismaServiceMock: any;
  let candidatesServiceMock: { processData: jest.Mock };
  let handlerObjectCreationMock: { execute: jest.Mock };
  let mailServiceMock: { sendMail: jest.Mock };
  let hireRequestServiceMock: Record<string, jest.Mock>;
  let positionRateConfigServiceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    prismaServiceMock = {
      candidate: {
        findMany: jest.fn(),
      },
      positionRateConfig: {
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
      findAll: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CronService,
        {provide: PrismaService, useValue: prismaServiceMock},
        {provide: CandidatesService, useValue: candidatesServiceMock},
        {provide: HandlerObjectCreation, useValue: handlerObjectCreationMock},
        { provide: MailService, useValue: mailServiceMock },
        { provide: HireRequestService, useValue: hireRequestServiceMock },
        { provide: PositionRateConfigService, useValue: positionRateConfigServiceMock },
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
      positionRateConfigServiceMock.findAll.mockResolvedValue([
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
      positionRateConfigServiceMock.findAll.mockResolvedValue([
        { position: 'Admin VA' },
        { position: 'Billing VA' },
      ]);
      prismaServiceMock.positionRateConfig.create.mockResolvedValue({});
      mailServiceMock.sendMail.mockResolvedValue({});

      const result = await service.syncPositionsFromHubspot();

      expect(result).toBe(true);
      expect(prismaServiceMock.positionRateConfig.create).toHaveBeenCalledWith({
        data: { position: 'New Position' },
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
