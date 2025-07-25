import { Test, TestingModule } from '@nestjs/testing';
import { CandidatesService } from './candidates.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadGatewayException } from '@nestjs/common';
import { dbToStageDictionary } from '../common/dictionaries/stage-dictionary';

describe('CandidatesService', () => {
  let service: CandidatesService;
  let prisma: PrismaService;

  const mockPrisma = {
    candidate: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockUser = {
    id: 'user-1',
    organization_id: 'org-1',
  } as any; // Cast as USER

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CandidatesService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<CandidatesService>(CandidatesService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all candidates without status filter', async () => {
      const mockCandidates = [{ id: '1' }, { id: '2' }];
      mockPrisma.candidate.findMany.mockResolvedValue(mockCandidates);

      const result = await service.findAll(mockUser, '');

      expect(prisma.candidate.findMany).toHaveBeenCalledWith({
        where: {
          organization_id: 'org-1',
          pipeline_status: undefined,
        },
      });
      expect(result).toEqual(mockCandidates);
    });

    it('should return filtered candidates by status', async () => {
      const status = 'interview';
      const dictionaryKey = Object.entries(dbToStageDictionary)
        .find(([key, value]) => value.toLowerCase() === status.toLowerCase())?.[0];

      const mockCandidates = [{ id: '3' }];
      mockPrisma.candidate.findMany.mockResolvedValue(mockCandidates);

      const result = await service.findAll(mockUser, status);

      expect(prisma.candidate.findMany).toHaveBeenCalledWith({
        where: {
          organization_id: 'org-1',
          pipeline_status: dictionaryKey,
        },
      });
      expect(result).toEqual(mockCandidates);
    });

    it('should throw BadGatewayException if findMany fails', async () => {
      mockPrisma.candidate.findMany.mockRejectedValue(new Error('DB error'));

      await expect(service.findAll(mockUser, '')).rejects.toThrow(BadGatewayException);
    });
  });

  describe('findOne', () => {
    it('should return candidate by id and organization_id', async () => {
      const mockCandidate = { id: '1', organization_id: 'org-1' };
      mockPrisma.candidate.findUnique.mockResolvedValue(mockCandidate);

      const result = await service.findOne('1', mockUser);

      expect(prisma.candidate.findUnique).toHaveBeenCalledWith({
        where: {
          id: '1',
          organization_id: 'org-1',
        },
      });
      expect(result).toEqual(mockCandidate);
    });

    it('should throw BadGatewayException if findUnique fails', async () => {
      mockPrisma.candidate.findUnique.mockRejectedValue(new Error('DB error'));

      await expect(service.findOne('1', mockUser)).rejects.toThrow(BadGatewayException);
    });
  });
});
