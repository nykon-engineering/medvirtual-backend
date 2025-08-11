import { Test, TestingModule } from '@nestjs/testing';
import { CronService } from './cron.service';
import { PrismaService } from '../prisma/prisma.service';
import { CandidatesService } from '../candidate/candidates.service';
import { reRunPipelineDto } from './dto/re-run-pipeline.dto';

describe('CronService', () => {
  let service: CronService;
  let prismaServiceMock: { candidate: { findMany: jest.Mock } };
  let candidatesServiceMock: { processData: jest.Mock };
  

  beforeEach(async () => {
    prismaServiceMock = {
      candidate: {
        findMany: jest.fn(),
      },
    };
  
    candidatesServiceMock = {
      processData: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CronService,
        {provide: PrismaService, useValue: prismaServiceMock},
        {provide: CandidatesService, useValue: candidatesServiceMock}
      ],
    }).compile();

    service = module.get<CronService>(CronService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

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
});
