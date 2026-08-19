import { Test, TestingModule } from '@nestjs/testing';
import { HandlerObjectPropertyChange } from './objectPropertyChange';
import { PrismaService } from '../../prisma/prisma.service';
import { HandlerObjectCreation } from './objectCreation';
import { CandidatesService } from '../../candidate/candidates.service';

const prismaMock = {
  candidate: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  candidateLanguage: { deleteMany: jest.fn(), create: jest.fn() },
  candidateSkill: { deleteMany: jest.fn(), create: jest.fn() },
  candidateRemovalLog: { create: jest.fn() },
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

describe('HandlerObjectPropertyChange', () => {
  let handler: HandlerObjectPropertyChange;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HandlerObjectPropertyChange,
        { provide: PrismaService, useValue: prismaMock },
        { provide: HandlerObjectCreation, useValue: objectCreationMock },
        { provide: CandidatesService, useValue: candidateServiceMock },
      ],
    }).compile();

    handler = module.get<HandlerObjectPropertyChange>(
      HandlerObjectPropertyChange,
    );

    jest.clearAllMocks();
    prismaMock.candidate.update.mockResolvedValue({});
    prismaMock.panelCandidate.findMany.mockResolvedValue([]);
  });

  it('should record a removal log with reason "lost" when moved to the Lost pipeline stage', async () => {
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

    expect(prismaMock.candidateRemovalLog.create).toHaveBeenCalledWith({
      data: {
        candidate_id: 'candidate-1',
        hubspot_id: 'hs-1',
        email: 'jane@example.com',
        name: 'Jane Doe',
        reason: 'lost',
      },
    });
  });

  it('should NOT record a removal log for other pipeline stage transitions', async () => {
    prismaMock.candidate.findUnique.mockResolvedValue({
      id: 'candidate-1',
      hubspot_id: 'hs-1',
      email: 'jane@example.com',
      name: 'Jane Doe',
    });

    await handler.execute({
      objectId: 'hs-1',
      propertyName: 'hs_pipeline_stage',
      propertyValue: '261075105' /* some other, active stage */,
    });

    expect(prismaMock.candidateRemovalLog.create).not.toHaveBeenCalled();
  });

  it('should NOT record a removal log for unrelated property changes', async () => {
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

    expect(prismaMock.candidateRemovalLog.create).not.toHaveBeenCalled();
  });
});
