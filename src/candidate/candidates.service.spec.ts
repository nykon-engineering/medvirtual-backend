import { Test, TestingModule } from '@nestjs/testing';
import { BadGatewayException, BadRequestException, NotFoundException } from '@nestjs/common';

import { CandidatesService } from './candidates.service';
import { PrismaService } from '../prisma/prisma.service';
import { TextractService } from '../textract/textract.service';
import { S3Service } from '../s3/s3.service';
import { GoogledriveService } from '../googledrive/googledrive.service';
import { OpenaiService } from '../openai/openai.service';
import { count } from 'console';

const mockPrisma = {
  candidate: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};

const textractMock = {
  startTextractJob: jest.fn(),
  getTextractResult: jest.fn(),
}

const s3Mock = {
  uploadFile: jest.fn(),
  getFile: jest.fn(),
  deleteFile: jest.fn(),
}

const googleMock = {
  downloadFile: jest.fn(),
}

const openAIMock = {
  organizeText: jest.fn(),
}

  describe('CandidatesService', () => {
    let service: CandidatesService;
    let prisma: PrismaService;

    
    const mockUser = {
      id: 'user-1',
      organization_id: 'org-1',
    } as any; // Cast as USER

    beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CandidatesService,
        { provide: PrismaService, useValue: mockPrisma,},
        { provide: TextractService, useValue: textractMock},
        { provide: S3Service, useValue: s3Mock },
        { provide: GoogledriveService, useValue: googleMock },
        { provide: OpenaiService, useValue: openAIMock },
      ],
    }).compile();

    service = module.get<CandidatesService>(CandidatesService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all candidates without filters', async () => {
      const mockCandidates = [{ id: '1' }, { id: '2' }];
      const mockTotal = 2;
      
      mockPrisma.$transaction.mockResolvedValue([mockCandidates, mockTotal]);

      const result = await service.findAll(mockUser, '');

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    
      expect(result).toEqual({
        data: mockCandidates,
        meta: {
          total: mockTotal,
          page: 1,
          perPage: 10,
          totalPages: 1,
        },
      });
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

    it('should return 400 if the candidate Id is empty', async () => {
      await expect(service.findOne('', mockUser)).rejects.toThrow(BadRequestException);
    });

    it('shoud return 401 if the candidate is not found', async () => {

      mockPrisma.candidate.findUnique.mockResolvedValue(null);

      await expect(service.findOne('1', mockUser)).rejects.toThrow(NotFoundException);
    })
  });
});
