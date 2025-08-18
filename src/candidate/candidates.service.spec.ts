import { Test, TestingModule } from '@nestjs/testing';
import { BadGatewayException, BadRequestException, NotFoundException } from '@nestjs/common';

import { CandidatesService } from './candidates.service';
import { PrismaService } from '../prisma/prisma.service';
import { TextractService } from '../textract/textract.service';
import { S3Service } from '../s3/s3.service';
import { GoogledriveService } from '../googledrive/googledrive.service';
import { OpenaiService } from '../openai/openai.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockPrisma = {
  candidate: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  candidateLanguage: {
    findMany: jest.fn(),
  },
  candidateSkill: {
    findMany: jest.fn(),
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
    it('should return all candidates without filters and transform pipeline_status', async () => {
      const mockCandidates = [
        { id: '1', pipeline_status: '261075105' },
        { id: '2', pipeline_status: '1087596819' }
      ];
      const mockTotal = 2;
  
      mockPrisma.$transaction.mockResolvedValue([mockCandidates, mockTotal]);
  
      const result = await service.findAll(mockUser);
  
      expect(result).toEqual({
        data: [
          { id: '1', pipeline_status: 'Available Candidates' },
          { id: '2', pipeline_status: 'Available Candidates - Part Time' }
        ],
        meta: {
          total: mockTotal,
          page: 1,
          perPage: 10,
          totalPages: 1
        }
      });
    });
  
    it('should apply filters for country, skills, and languages', async () => {
      const mockCandidates = [{ id: '1', pipeline_status: '261075105' }];
      const mockTotal = 1;
    
      mockPrisma.candidate.findMany.mockResolvedValue(mockCandidates);
      mockPrisma.candidate.count.mockResolvedValue(mockTotal);
    
      await service.findAll(
        mockUser,
        'Brazil',            // country
        undefined,
        '3000',              // monthly_compensation_from
        '5000',              // monthly_compensation_to
        '5',                 // years_of_experience
        'Developer',         // specialization
        'aws,office',        // skills
        'English,Spanish',   // languages
        2,                   // page
        5                    // perPage
      );
    
      // Captura o "where" diretamente da chamada de findMany
      const whereArgs = mockPrisma.candidate.findMany.mock.calls[0][0].where;
    
      expect(whereArgs.OR[0].skills).toEqual({
        some: { skill_name: { in: ['aws', 'office'] } }
      });
    
      expect(whereArgs.OR[0].languages).toEqual({
        some: { name: { in: ['English', 'Spanish'] } }
      });
    });
    
  
    it('should throw BadGatewayException when prisma fails', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('DB error'));
  
      await expect(service.findAll(mockUser)).rejects.toThrow(BadGatewayException);
    });
  });

  describe('findOne', () => {
    it('should return candidate by id and organization_id', async () => {
      const mockCandidate = {
        id: '1',
        organization_id: 'org-1',
        first_name: 'John',
        last_name: 'Doe',
        email: 'a@a.com',
        name: 'John Doe',
        pipeline_status: '1',
        about_me: 'About me',
        tools: 'JavaScript, TypeScript',
        medical_tools: 'None',
        country: 'USA',
        specialization: 'Software Development',
        years_of_experience: 5,
        hourly_pay_rate: 5,
        employment_type: 'Full-time',
        educations: [{ degree: 'BSc', institution: 'University', year: '2020' }],
        experiences: [
          {
            company: 'Company A',
            position: 'Developer',
            start_date: '2021-01-01',
            end_date: '2022-01-01',
            responsibilities: 'Developing software',
          },
        ],
        skills: [{ skill_name: 'JavaScript', skill_type: 'technical' }],
        languages: [{ name: 'English' }],
      };
      mockPrisma.candidate.findUnique.mockResolvedValue(mockCandidate);

      const result = await service.findOne('1', mockUser);

      expect(prisma.candidate.findUnique).toHaveBeenCalledWith({
        where: {
          id: '1',
          organization_id: 'org-1',
        },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          name: true,
          specialization: true,
          years_of_experience: true,
          hourly_pay_rate: true,
          employment_type: true,
          pipeline_status: true,
          about_me: true,
          tools: true,
          medical_tools: true,
          country: true,
          educations: {
            select: {
              degree: true,
              institution: true,
              year: true,
            },
          },
          experiences: {
            orderBy: { start_date: 'desc' },
            select: {
              company: true,
              position: true,
              start_date: true,
              end_date: true,
              responsabilities: true,
            },
          },
          skills: {
            select: {
              skill_name: true,
              skill_type: true,
            },
          },
          languages: {
            select: {
              name: true,
            },
          },
        }
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

  describe('getProperties', () => {
    it('should return distinct languages when field is "languages"', async () => {
      const mockLanguages = [{ name: 'English' }, { name: 'Spanish' }];
      mockPrisma.candidateLanguage = { findMany: jest.fn().mockResolvedValue(mockLanguages) };
  
      const result = await service.getProperties({ fields: 'languages' });
  
      expect(mockPrisma.candidateLanguage.findMany).toHaveBeenCalledWith({
        where: {
          candidate: {
            pipeline_status: {
              in: ['1087596819', '261075105'],
            },
          },
        },
        select: { name: true },
        distinct: ['name'],
      });
      expect(result).toEqual({ languages: mockLanguages });
    });
  
    it('should return distinct skills when field is "skills"', async () => {
      const mockSkills = [{ skill_name: 'JavaScript' }, { skill_name: 'TypeScript' }];
      mockPrisma.candidateSkill = { findMany: jest.fn().mockResolvedValue(mockSkills) };
  
      const result = await service.getProperties({ fields: 'skills' });
  
      expect(mockPrisma.candidateSkill.findMany).toHaveBeenCalledWith({
        where: {
          candidate: {
            pipeline_status: {
              in: ['1087596819', '261075105'],
            },
          },
        },
        select: { skill_name: true },
        distinct: ['skill_name'],
      });
      expect(result).toEqual({ skills: mockSkills });
    });
  
    it('should return distinct values for other fields', async () => {
      const mockCountries = [{ country: 'USA' }, { country: 'Brazil' }];
      mockPrisma.candidate.findMany.mockResolvedValue(mockCountries);
  
      const result = await service.getProperties({ fields: 'country' });
  
      expect(mockPrisma.candidate.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { pipeline_status: '261075105' },
            { pipeline_status: '1087596819' },
          ],
          AND: [
            {
              country: {
                not: null
              }
            }
          ] 
        },
        distinct: ['country'],
        select: { country: true },
      });
      expect(result).toEqual({ country: mockCountries });
    });
  
    it('should handle multiple fields', async () => {
      const mockLanguages = [{ name: 'English' }];
      const mockSkills = [{ skill_name: 'JavaScript' }];
      const mockCountries = [{ country: 'USA' }];
  
      mockPrisma.candidateLanguage = { findMany: jest.fn().mockResolvedValue(mockLanguages) };
      mockPrisma.candidateSkill = { findMany: jest.fn().mockResolvedValue(mockSkills) };
      mockPrisma.candidate.findMany.mockResolvedValue(mockCountries);
  
      const result = await service.getProperties({ fields: 'languages,skills,country' });
  
      expect(result).toEqual({
        languages: mockLanguages,
        skills: mockSkills,
        country: mockCountries,
      });
    });
  
    it('should throw BadRequestException on error', async () => {
      mockPrisma.candidate.findMany.mockRejectedValue(new Error('DB error'));
  
      await expect(service.getProperties({ fields: 'country' })).rejects.toThrow(BadRequestException);
    });
  });
  
  describe('updateStatusHubspot', () => {

    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    const mockCandidate = {
      id: '1',
      hubspot_id: 'hub-123',
    };
  
    it('should throw BadRequestException if candidate id is missing', async () => {
      await expect(service.updateStatusHubspot('', { status: 'Available Candidates' }))
        .rejects
        .toThrow(BadRequestException);
    });
  
    it('should throw BadRequestException if status is missing', async () => {
      await expect(service.updateStatusHubspot('1', { status: '' }))
        .rejects
        .toThrow(BadRequestException);
    });
  
    it('should throw BadRequestException if status is invalid', async () => {
      await expect(service.updateStatusHubspot('1', { status: 'invalid-status' }))
        .rejects
        .toThrow(BadRequestException);
    });
  
    it('should throw NotFoundException if candidate does not exist', async () => {
      mockPrisma.candidate.findUnique.mockResolvedValue(null);
  
      await expect(service.updateStatusHubspot('1', { status: 'Available Candidates' }))
        .rejects
        .toThrow(NotFoundException);
    });
  
    it('should throw BadGatewayException if HubSpot API fails', async () => {
      mockPrisma.candidate.findUnique.mockResolvedValue(mockCandidate);
      mockedAxios.patch.mockResolvedValue({ status: 500 } as any);
  
      await expect(service.updateStatusHubspot('1', { status: 'Available Candidates' }))
        .rejects
        .toThrow(BadGatewayException);
    });
  
    it('should throw BadGatewayException if prisma update fails', async () => {
      mockPrisma.candidate.findUnique.mockResolvedValue(mockCandidate);
      mockedAxios.patch.mockResolvedValue({ status: 200 } as any);
      mockPrisma.candidate.update.mockResolvedValue(null);
  
      await expect(service.updateStatusHubspot('1', { status: 'Available Candidates' }))
        .rejects
        .toThrow(BadGatewayException);
    });
  
    it('should update candidate status successfully', async () => {
      const updatedCandidate = { id: '1', pipeline_status: '261075105' };
      mockPrisma.candidate.findUnique.mockResolvedValue(mockCandidate);
      mockedAxios.patch.mockResolvedValue({ status: 200 } as any);
      mockPrisma.candidate.update.mockResolvedValue(updatedCandidate);
  
      const result = await service.updateStatusHubspot('1', { status: 'Available Candidates' });
  
      expect(mockPrisma.candidate.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        select: { hubspot_id: true },
      });
      expect(mockedAxios.patch).toHaveBeenCalled();
      expect(mockPrisma.candidate.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { pipeline_status: '261075105' }, // stageName do dicionário
      });
      expect(result).toEqual(updatedCandidate);
    });
  });




});