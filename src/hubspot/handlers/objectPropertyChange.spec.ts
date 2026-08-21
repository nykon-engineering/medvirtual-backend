import { Test, TestingModule } from '@nestjs/testing';
import { HandlerObjectPropertyChange } from './objectPropertyChange';
import { PrismaService } from '../../prisma/prisma.service';
import { HandlerObjectCreation } from './objectCreation';
import { CandidatesService } from '../../candidate/candidates.service';
import { CandidateAuditService } from '../../candidate/candidate-audit.service';

const prismaMock = {
  candidate: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  candidateLanguage: { deleteMany: jest.fn(), create: jest.fn() },
  candidateSkill: { deleteMany: jest.fn(), create: jest.fn() },
  panelCandidate: { findMany: jest.fn(), delete: jest.fn(), count: jest.fn() },
  candidatePanel: { findUnique: jest.fn(), update: jest.fn() },
  hireRequest: { update: jest.fn() },
};

const objectCreationMock = { execute: jest.fn() };
const candidateServiceMock = {
  removeFromOfferPanels: jest.fn(),
  processData: jest.fn(),
  processAvatar: jest.fn(),
};
const candidateAuditMock = {
  log: jest.fn(),
  logOrThrow: jest.fn(),
  logMany: jest.fn(),
};

describe('HandlerObjectPropertyChange', () => {
  let handler: HandlerObjectPropertyChange;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HandlerObjectPropertyChange,
        { provide: PrismaService, useValue: prismaMock },
        { provide: HandlerObjectCreation, useValue: objectCreationMock },
        { provide: CandidatesService, useValue: candidateServiceMock },
        { provide: CandidateAuditService, useValue: candidateAuditMock },
      ],
    }).compile();

    handler = module.get<HandlerObjectPropertyChange>(
      HandlerObjectPropertyChange,
    );

    jest.clearAllMocks();
    prismaMock.candidate.update.mockResolvedValue({});
    prismaMock.panelCandidate.findMany.mockResolvedValue([]);
  });

  it('should record a pipeline_status_changed audit log with the Lost stage id when moved to the Lost pipeline stage', async () => {
    prismaMock.candidate.findUnique.mockResolvedValue({
      id: 'candidate-1',
      hubspot_id: 'hs-1',
      email: 'jane@example.com',
      name: 'Jane Doe',
    });

    await handler.execute({
      objectId: 'hs-1',
      propertyName: 'hs_pipeline_stage',
      propertyValue: '261173428',
    });

    expect(candidateAuditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateId: 'candidate-1',
        event: 'pipeline_status_changed',
        after: expect.objectContaining({ pipeline_status: '261173428' }),
      }),
    );
  });

  it('should NOT record a pipeline_status_changed audit log for unrelated property changes', async () => {
    prismaMock.candidate.findUnique.mockResolvedValue({
      id: 'candidate-1',
      hubspot_id: 'hs-1',
      email: 'jane@example.com',
      name: 'Jane Doe',
    });

    await handler.execute({
      objectId: 'hs-1',
      propertyName: 'language_spoken',
      propertyValue: 'English',
    });

    expect(candidateAuditMock.log).not.toHaveBeenCalled();
  });
});
