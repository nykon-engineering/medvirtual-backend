import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { HandlerObjectDeletion } from './objectDeletion';
import { PrismaService } from '../../prisma/prisma.service';

const prismaMock = {
  candidate: {
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
  candidateSkill: { deleteMany: jest.fn() },
  candidateLanguage: { deleteMany: jest.fn() },
  candidateEducation: { deleteMany: jest.fn() },
  candidateExperience: { deleteMany: jest.fn() },
  panelCandidate: { deleteMany: jest.fn() },
  candidateRemovalLog: { create: jest.fn() },
};

describe('HandlerObjectDeletion', () => {
  let handler: HandlerObjectDeletion;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HandlerObjectDeletion,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    handler = module.get<HandlerObjectDeletion>(HandlerObjectDeletion);

    jest.clearAllMocks();
  });

  it('should no-op when the candidate no longer exists locally', async () => {
    prismaMock.candidate.findUnique.mockResolvedValue(null);

    await handler.execute({ objectId: 'hs-1' });

    expect(prismaMock.candidateRemovalLog.create).not.toHaveBeenCalled();
    expect(prismaMock.candidate.delete).not.toHaveBeenCalled();
  });

  it('should record a removal log with reason "deleted" before hard-deleting the candidate', async () => {
    prismaMock.candidate.findUnique.mockResolvedValue({
      id: 'candidate-1',
      hubspot_id: 'hs-1',
      email: 'jane@example.com',
      name: 'Jane Doe',
    });

    const callOrder: string[] = [];
    prismaMock.candidateRemovalLog.create.mockImplementation(async () => {
      callOrder.push('create');
      return {};
    });
    prismaMock.candidate.delete.mockImplementation(async () => {
      callOrder.push('delete');
      return {};
    });

    await handler.execute({ objectId: 'hs-1' });

    expect(prismaMock.candidateRemovalLog.create).toHaveBeenCalledWith({
      data: {
        candidate_id: 'candidate-1',
        hubspot_id: 'hs-1',
        email: 'jane@example.com',
        name: 'Jane Doe',
        reason: 'deleted',
      },
    });
    expect(prismaMock.candidate.delete).toHaveBeenCalledWith({
      where: { id: 'candidate-1' },
    });
    expect(callOrder).toEqual(['create', 'delete']);
  });

  it('should wrap unexpected errors in a BadRequestException', async () => {
    prismaMock.candidate.findUnique.mockRejectedValue(new Error('db down'));

    await expect(handler.execute({ objectId: 'hs-1' })).rejects.toThrow(
      BadRequestException,
    );
  });
});
