import { Test, TestingModule } from '@nestjs/testing';
import { HireRequestService } from './hire-request.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { USER } from '@prisma/client';
import axios from 'axios';
import { panelReadyDTO } from './dto/panelReady-hire-request.dto';
import { ConfirmPanelHireRequestDto } from './dto/confirm-panel-hire-request.dto';
import { hireRequestDictionary } from '../common/dictionaries/hire-request-dictionary';
import { find } from 'rxjs';
import { count } from 'console';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const prismaMock = {
  hireRequest: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    updateMany: jest.fn(),
  },
  hireRequestSkill: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  candidatePanel:{
    create: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
  },
  candidate: {
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  panelCandidate: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
    findFirst: jest.fn(),
  },
  interview: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  organization: {
    findUnique: jest.fn(),
  }
};

describe('HireRequestService', () => {
  let service: HireRequestService;
  let user: USER;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HireRequestService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<HireRequestService>(HireRequestService);
    user = {
      id: '1',
      organization_id: 'org1',
      role: 'organization_admin',
      email: 'test@test.com',
      password: '',
      organization_name: 'Default Organization',
      first_name: 'John',
      last_name: 'Doe',
      phone: '',
      avatar: '',
      job_title: '',
      workos_id: '',
      authentication_method: 'OwnSign',
      status: 'active',
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } ;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const baseDto = {
      title: 'Dev',
      description: 'Job description',
    };
  
    beforeEach(() => {
      jest.clearAllMocks();
    });
  

    it('should create hire request with skills', async () => {
      prismaMock.hireRequest.create.mockResolvedValue({ id: 'hr1' });
      prismaMock.hireRequestSkill.createMany.mockResolvedValue({ count: 2 });
      prismaMock.candidatePanel.create.mockResolvedValue({ id: 'panel1' });
      prismaMock.organization.findUnique.mockResolvedValue({ id: 'org1' });

      const dto = {
        title: 'Dev',
        skills: [
          { name: 'JS', level: 'advanced' },
          { name: 'TS', level: 'intermediate' },
        ],
      };

      const result = await service.create(dto as any, user);
      expect(result).toBe('Hire request created successfully');
      expect(prismaMock.hireRequest.create).toHaveBeenCalled();
      expect(prismaMock.hireRequestSkill.createMany).toHaveBeenCalled();
      expect(prismaMock.candidatePanel.create).toHaveBeenCalled();
    });

    it('should create hire request without skills', async () => {
      prismaMock.hireRequest.create.mockResolvedValue({ id: 'hr1' });
      prismaMock.candidatePanel.create.mockResolvedValue({ id: 'panel1' });
  
      const dto = { ...baseDto };
  
      const result = await service.create(dto as any, user);
      expect(result).toBe('Hire request created successfully');
      expect(prismaMock.hireRequestSkill.createMany).not.toHaveBeenCalled();
      expect(prismaMock.candidatePanel.create).toHaveBeenCalled();
    });

    it('should set status as pending_signature if user is prospect', async () => {
      prismaMock.hireRequest.create.mockResolvedValue({ id: 'hr1' });
      prismaMock.candidatePanel.create.mockResolvedValue({ id: 'panel1' });
      prismaMock.organization.findUnique.mockResolvedValue({ id: 'org1' });
  
      const user2 = { ...user, status: 'prospect' };
      const dto = { ...baseDto };
  
      await service.create(dto as any, user2);
  
      expect(prismaMock.hireRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'pending_signature',
          }),
        }),
      );
    });

    it('should throw NotFoundException if user has no org', async () => {
      await expect(service.create({} as any, { ...user, organization_id: null }))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if hireRequest is not created', async () => {
      prismaMock.hireRequest.create.mockResolvedValue(null);
  
      await expect(service.create(baseDto as any, user))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return hire requests', async () => {
      prismaMock.hireRequest.findMany.mockResolvedValue([{ id: 'hr1' }]);
      const result = await service.findAll(user);
      expect(result).toEqual([{ id: 'hr1' }]);
    });

    it('should throw NotFoundException if no org', async () => {
      await expect(service.findAll({ ...user, organization_id: null }))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if role missing', async () => {
      await expect(service.findAll({ ...user, role: '' }))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if no results', async () => {
      prismaMock.hireRequest.findMany.mockResolvedValue(null);
      await expect(service.findAll(user))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('should return hire request', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue({ id: 'hr1' });
      const result = await service.findOne('hr1', user);
      expect(result).toEqual({ id: 'hr1' });
    });

    it('should throw NotFoundException if no org', async () => {
      await expect(service.findOne('hr1', { ...user, organization_id: null }))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if not found', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue(null);
      await expect(service.findOne('hr1', user))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update hire request with skills', async () => {
      prismaMock.hireRequest.update.mockResolvedValue({ id: 'hr1' });
      prismaMock.hireRequestSkill.deleteMany.mockResolvedValue({});
      prismaMock.hireRequestSkill.createMany.mockResolvedValue({ count: 2 });

      const dto = {
        title: 'Updated',
        skills: [{ name: 'JS', level: 'advanced' }],
      };

      const result = await service.update('hr1', dto as any, user);
      expect(result).toHaveProperty('id');
      expect(prismaMock.hireRequest.update).toHaveBeenCalled();
      expect(prismaMock.hireRequestSkill.deleteMany).toHaveBeenCalled();
      expect(prismaMock.hireRequestSkill.createMany).toHaveBeenCalled();
    });

    it('should throw NotFoundException if no org', async () => {
      await expect(service.update('hr1', {} as any, { ...user, organization_id: null }))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if update fails', async () => {
      prismaMock.hireRequest.update.mockResolvedValue(null);
      await expect(service.update('hr1', {} as any, user))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if skills update fails', async () => {
      prismaMock.hireRequest.update.mockResolvedValue({ id: 'hr1' });
      prismaMock.hireRequestSkill.deleteMany.mockResolvedValue({});
      prismaMock.hireRequestSkill.createMany.mockResolvedValue(null);

      await expect(
        service.update('hr1', { skills: [{ name: 'JS', level: 'advanced' }] } as any, user)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
  
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    it('should throw NotFoundException if user has no organization', async () => {
      const invalidUser: USER = {
        id: 'u1',
        email: '',
        organization_id: null,
        organization_name: '',
        first_name: '',
        last_name: '',
        password: '',
        phone: '',
        avatar: '',
        job_title: '',
        role: '',
        workos_id: '',
        authentication_method: 'OwnSign',
        status: 'inactive',
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
  
      await expect(service.remove('hire1', invalidUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  
    it('should throw NotFoundException if hire request not found', async () => {
      prismaMock.hireRequest.findUnique = jest.fn().mockResolvedValue(null);
  
      await expect(service.remove('hire1', user)).rejects.toThrow(
        NotFoundException,
      );
    });
  
    it('should throw NotFoundException if statusKey not found', async () => {
      prismaMock.hireRequest.findUnique = jest.fn().mockResolvedValue({
        id: 'hire1',
        status: 'UNKNOWN_STATUS',
      });
  
      await expect(service.remove('hire1', user)).rejects.toThrow(
        NotFoundException,
      );
    });
  
    it('should throw BadRequestException if statusKey > 2', async () => {
      prismaMock.hireRequest.findUnique = jest.fn().mockResolvedValue({
        id: 'hire1',
        status: hireRequestDictionary[3], // supondo que status 3 já exista
      });
  
      await expect(service.remove('hire1', user)).rejects.toThrow(
        BadRequestException,
      );
    });
  
    it('should throw BadRequestException if hire request not deleted', async () => {
      prismaMock.hireRequest.findUnique = jest.fn().mockResolvedValue({
        id: 'hire1',
        status: hireRequestDictionary[1],
      });
      prismaMock.hireRequest.delete = jest.fn().mockResolvedValue(null);
  
      await expect(service.remove('hire1', user)).rejects.toThrow(
        BadRequestException,
      );
    });
  
    it('should delete hire request successfully', async () => {
      prismaMock.hireRequest.findUnique = jest.fn().mockResolvedValue({
        id: 'hire1',
        status: hireRequestDictionary[1], // status válido (<= 2)
      });
      prismaMock.hireRequest.delete = jest.fn().mockResolvedValue({
        id: 'hire1',
      });
  
      const result = await service.remove('hire1', user);
  
      expect(result).toBe(true);
      expect(prismaMock.hireRequest.delete).toHaveBeenCalledWith({
        where: { id: 'hire1' },
      });
    });
  });

  describe('updateStatus', () => {
    const hireRequestDictionary = {
      '0': 'pending',
      '1': 'in_progress',
      '2': 'completed',
    };
  
    it('should throw NotFoundException if user has no organization', async () => {
      await expect(
        service.updateStatus('hr1', { status: 'new' }, { ...user, organization_id: null })
      ).rejects.toThrow(NotFoundException);
    });
  
    it('should throw BadRequestException if data or status is missing', async () => {
      await expect(service.updateStatus('hr1', null as any, user)).rejects.toThrow(BadRequestException);
      await expect(service.updateStatus('hr1', {} as any, user)).rejects.toThrow(BadRequestException);
    });
  
    it('should throw NotFoundException if hire request not found', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue(null);
      await expect(
        service.updateStatus('hr1', { status: 'new' }, user)
      ).rejects.toThrow(NotFoundException);
    });
  
    it('should update status if change is allowed (neighbor statuses)', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue({ status: 'new' });
      prismaMock.hireRequest.update.mockResolvedValue({ status: 'sourcing' });
  
      const result = await service.updateStatus('hr1', { status: 'sourcing' }, user);
      expect(result).toBe(true);
      expect(prismaMock.hireRequest.update).toHaveBeenCalledWith({
        where: { id: 'hr1' },
        data: { status: 'sourcing' },
      });
    });
  
    it('should throw BadRequestException if status change is not allowed', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue({ status: 'pending' });
  
      await expect(
        service.updateStatus('hr1', { status: 'placement_completed' }, user)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reassign', () => {
    const baseData = { user_id: 'newUser' };
  
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    it('should reassign hire request successfully', async () => {
      // Mock do updateMany
      prismaMock.hireRequest.updateMany.mockResolvedValue({ count: 1 });
  
      const result = await service.reassign('hr1', user, baseData);
  
      expect(result).toBe(true);
  
      expect(prismaMock.hireRequest.updateMany).toHaveBeenCalledWith({
        where: { id: 'hr1' },
        data: { assign_user_id: 'newUser' },
      });
    });
  
    it('should throw NotFoundException if user has no organization', async () => {
      await expect(
        service.reassign('hr1', { ...user, organization_id: null }, baseData)
      ).rejects.toThrow(NotFoundException);
    });

  });
  
  describe('showMatchCandidates', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    it('should return scored candidates sorted by score', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue({
        id: 'hr1',
        specialization: 'Frontend',
        location: 'Brazil',
        availability: 'full-time',
        salary_range_from: 4000,
        salary_range_to: 8000,
        skills: [
          { skill_name: 'React', required_level: 'advanced' },
          { skill_name: 'JavaScript', required_level: 'advanced' },
        ],
      });
  
      prismaMock.candidate.findMany.mockResolvedValue([
        {
          id: 'cand1',
          specialization: 'Frontend',
          country: 'Brazil',
          employment_type: 'full-time',
          hourly_pay_rate: 30,
          skills: [
            { skill_name: 'React' },
            { skill_name: 'JavaScript' },
            { skill_name: 'CSS' },
          ],
          experiences: [],
          educations: [],
        },
        {
          id: 'cand2',
          specialization: 'Frontend',
          country: 'Brazil',
          employment_type: 'full-time',
          hourly_pay_rate: 35,
          skills: [
            { skill_name: 'React' },
          ],
          experiences: [],
          educations: [],
        },
      ]);
  
      const result = await service.showMatchCandidates('hr1', user);
  
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('cand1'); // mais skills combinadas
      expect(result[0]).toHaveProperty('matchedSkills', ['React', 'JavaScript']);
      expect(result[0].score).toBe(2);
      expect(result[1].score).toBe(1);
  
      expect(prismaMock.hireRequest.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'hr1',
        },
        select: expect.any(Object),
      });
  
      expect(prismaMock.candidate.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          specialization: { contains: 'Frontend', mode: 'insensitive' },
          country: 'Brazil',
          employment_type: 'full-time',
        }),
      }));
    });
  
    it('should throw NotFoundException if user has no organization', async () => {
      await expect(service.showMatchCandidates('hr1', { ...user, organization_id: null }))
        .rejects.toThrow(NotFoundException);
    });
  
    it('should throw NotFoundException if hireRequest is not found', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue(null);
  
      await expect(service.showMatchCandidates('hr1', user))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('confirmPanel', () => {
    const panelData = {
      hireRequest_id: 'hr1',
      candidates_id: ['cand1', 'cand2', 'cand3', 'cand4', 'cand5'],
    };
  
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    it('should throw NotFoundException if user has no organization', async () => {
      await expect(
        service.confirmPanel(panelData, { ...user, organization_id: null })
      ).rejects.toThrow(NotFoundException);
    });
  
    it('should throw BadRequestException if data is missing', async () => {
      await expect(
        service.confirmPanel({} as ConfirmPanelHireRequestDto, user)
      ).rejects.toThrow(BadRequestException);
    });
  
    it('should throw NotFoundException if panel does not exist', async () => {
      prismaMock.candidatePanel.findFirst.mockResolvedValue(null);
  
      await expect(service.confirmPanel(panelData, user))
        .rejects.toThrow(NotFoundException);
    });
  
    it('should skip addCandidates if candidates_id is empty', async () => {
      prismaMock.candidatePanel.findFirst.mockResolvedValue({ id: 'panel1' });
      prismaMock.hireRequest.update.mockResolvedValue({ id: 'hr1', status: 'sourcing' });
      prismaMock.candidate.updateMany.mockResolvedValue({ count: 0 });
      prismaMock.candidate.findMany.mockResolvedValue([{ id: 'cand1', hubspot_id: 'hub1' }]);
      jest.spyOn(axios, 'patch').mockResolvedValue({ data: {} });
  
      const result = await service.confirmPanel(
        { ...panelData, candidates_id: [] },
        user
      );
  
      expect(result).toBe(true);
      expect(prismaMock.panelCandidate.createMany).not.toHaveBeenCalled();
    });
  
    it('should throw BadRequestException if addCandidates fails', async () => {
      prismaMock.candidatePanel.findFirst.mockResolvedValue({ id: 'panel1' });
      prismaMock.panelCandidate.createMany.mockResolvedValue(null);
  
      await expect(service.confirmPanel(panelData, user))
        .rejects.toThrow(BadRequestException);
    });
  
    it('should throw BadRequestException if panelUpdated fails', async () => {
      prismaMock.candidatePanel.findFirst.mockResolvedValue({ id: 'panel1' });
      prismaMock.panelCandidate.createMany.mockResolvedValue({ count: 5 });
      prismaMock.hireRequest.update.mockResolvedValue(null);
  
      await expect(service.confirmPanel(panelData, user))
        .rejects.toThrow(BadRequestException);
    });
  
    it('should throw BadRequestException if candidates update fails', async () => {
      prismaMock.candidatePanel.findFirst.mockResolvedValue({ id: 'panel1' });
      prismaMock.panelCandidate.createMany.mockResolvedValue({ count: 5 });
      prismaMock.hireRequest.update.mockResolvedValue({ id: 'hr1', status: 'sourcing' });
      prismaMock.candidate.updateMany.mockResolvedValue(null);
  
      await expect(service.confirmPanel(panelData, user))
        .rejects.toThrow(BadRequestException);
    });
  
    it('should throw NotFoundException if candidates not found', async () => {
      prismaMock.candidatePanel.findFirst.mockResolvedValue({ id: 'panel1' });
      prismaMock.panelCandidate.createMany.mockResolvedValue({ count: 5 });
      prismaMock.hireRequest.update.mockResolvedValue({ id: 'hr1', status: 'sourcing' });
      prismaMock.candidate.updateMany.mockResolvedValue({ count: 5 });
      prismaMock.candidate.findMany.mockResolvedValue(null);
  
      await expect(service.confirmPanel(panelData, user))
        .rejects.toThrow(NotFoundException);
    });
  
    it('should confirm panel, update candidates and return true', async () => {
      prismaMock.candidatePanel.findFirst.mockResolvedValue({ id: 'panel1' });
      prismaMock.panelCandidate.createMany.mockResolvedValue({ count: 5 });
      prismaMock.hireRequest.update.mockResolvedValue({ id: 'hr1', status: 'sourcing' });
      prismaMock.candidate.updateMany.mockResolvedValue({ count: 5 });
      prismaMock.candidate.findMany.mockResolvedValue([
        { id: 'cand1', hubspot_id: 'hub1' },
        { id: 'cand2', hubspot_id: 'hub2' },
      ]);
  
      const axiosPatchMock = jest.spyOn(axios, 'patch').mockResolvedValue({ data: {} });
  
      const result = await service.confirmPanel(panelData, user);
  
      expect(result).toBe(true);
  
      expect(prismaMock.panelCandidate.createMany).toHaveBeenCalled();
      expect(prismaMock.hireRequest.update).toHaveBeenCalled();
      expect(prismaMock.candidate.updateMany).toHaveBeenCalled();
  
      // valida que chamou HubSpot com hubspot_id real
      expect(axiosPatchMock).toHaveBeenCalledTimes(2);
      expect(axiosPatchMock).toHaveBeenCalledWith(
        `https://api.hubapi.com/crm/v3/objects/${process.env.HUBSPOT_CUSTOM_OBJECT}/hub1`,
        { properties: { hs_pipeline_stage: expect.any(String) } },
        {
          headers: {
            Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );
    });
  });
  
  describe('editPanel', () => {
    const panelData = {
      hireRequest_id: 'hr1',
      candidates_id: ['cand1', 'cand2', 'cand3', 'cand4', 'cand5'],
    };
  
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    it('should throw NotFoundException if user has no organization', async () => {
      await expect(
        service.editPanel(panelData, { ...user, organization_id: null })
      ).rejects.toThrow(NotFoundException);
    });
  
    it('should throw BadRequestException if data is missing', async () => {
      await expect(service.editPanel({} as ConfirmPanelHireRequestDto, user))
        .rejects.toThrow(BadRequestException);
    });
  
    it('should throw BadRequestException if candidates_id length is less than 3', async () => {
      await expect(
        service.editPanel({ ...panelData, candidates_id: ['cand1', 'cand2'] }, user)
      ).rejects.toThrow(BadRequestException);
    });
  
    it('should throw NotFoundException if panel does not exist', async () => {
      prismaMock.candidatePanel.findFirst.mockResolvedValue(null);
  
      await expect(service.editPanel(panelData, user))
        .rejects.toThrow(NotFoundException);
    });
  
    it('should throw BadRequestException if removeCandidates fails', async () => {
      prismaMock.candidatePanel.findFirst.mockResolvedValue({ id: 'panel1' });
      prismaMock.panelCandidate.deleteMany.mockResolvedValue(null);
  
      await expect(service.editPanel(panelData, user))
        .rejects.toThrow(BadRequestException);
    });
  
    it('should throw BadRequestException if addCandidates fails', async () => {
      prismaMock.candidatePanel.findFirst.mockResolvedValue({ id: 'panel1' });
      prismaMock.panelCandidate.deleteMany.mockResolvedValue({ count: 5 });
      prismaMock.panelCandidate.createMany.mockResolvedValue(null);
  
      await expect(service.editPanel(panelData, user))
        .rejects.toThrow(BadRequestException);
    });
  
    it('should throw BadRequestException if panelUpdated fails', async () => {
      prismaMock.candidatePanel.findFirst.mockResolvedValue({ id: 'panel1' });
      prismaMock.panelCandidate.deleteMany.mockResolvedValue({ count: 5 });
      prismaMock.panelCandidate.createMany.mockResolvedValue({ count: 5 });
      prismaMock.hireRequest.update.mockResolvedValue(null);
  
      await expect(service.editPanel(panelData, user))
        .rejects.toThrow(BadRequestException);
    });
  
    it('should throw BadRequestException if candidates update fails', async () => {
      prismaMock.candidatePanel.findFirst.mockResolvedValue({ id: 'panel1' });
      prismaMock.panelCandidate.deleteMany.mockResolvedValue({ count: 5 });
      prismaMock.panelCandidate.createMany.mockResolvedValue({ count: 5 });
      prismaMock.hireRequest.update.mockResolvedValue({ id: 'hr1', status: 'sourcing' });
      prismaMock.candidate.updateMany.mockResolvedValue(null);
  
      await expect(service.editPanel(panelData, user))
        .rejects.toThrow(BadRequestException);
    });
  
    it('should throw NotFoundException if candidates not found', async () => {
      prismaMock.candidatePanel.findFirst.mockResolvedValue({ id: 'panel1' });
      prismaMock.panelCandidate.deleteMany.mockResolvedValue({ count: 5 });
      prismaMock.panelCandidate.createMany.mockResolvedValue({ count: 5 });
      prismaMock.hireRequest.update.mockResolvedValue({ id: 'hr1', status: 'sourcing' });
      prismaMock.candidate.updateMany.mockResolvedValue({ count: 5 });
      prismaMock.candidate.findMany.mockResolvedValue(null);
  
      await expect(service.editPanel(panelData, user))
        .rejects.toThrow(NotFoundException);
    });
  
    it('should edit panel, update candidates and call HubSpot for each candidate', async () => {
      prismaMock.candidatePanel.findFirst.mockResolvedValue({ id: 'panel1' });
      prismaMock.panelCandidate.deleteMany.mockResolvedValue({ count: 5 });
      prismaMock.panelCandidate.createMany.mockResolvedValue({ count: 5 });
      prismaMock.hireRequest.update.mockResolvedValue({ id: 'hr1', status: 'sourcing' });
      prismaMock.candidate.updateMany.mockResolvedValue({ count: 5 });
      prismaMock.candidate.findMany.mockResolvedValue([
        { id: 'cand1', hubspot_id: 'hub1' },
        { id: 'cand2', hubspot_id: 'hub2' },
        { id: 'cand3', hubspot_id: 'hub3' },
        { id: 'cand4', hubspot_id: 'hub4' },
        { id: 'cand5', hubspot_id: 'hub5' },
      ]);
  
      const axiosPatchMock = jest.spyOn(axios, 'patch').mockResolvedValue({ data: {} });
  
      const result = await service.editPanel(panelData, user);
      expect(result).toBe(true);
  
      expect(prismaMock.candidatePanel.findFirst).toHaveBeenCalledWith({
        where: { hire_request_id: panelData.hireRequest_id },
        select: { id: true },
      });
  
      expect(prismaMock.panelCandidate.deleteMany).toHaveBeenCalledWith({
        where: { panel_id: 'panel1' },
      });
  
      expect(prismaMock.panelCandidate.createMany).toHaveBeenCalledWith({
        data: panelData.candidates_id.map(candidateId => ({
          candidate_id: candidateId,
          panel_id: 'panel1',
        })),
      });
  
      expect(prismaMock.hireRequest.update).toHaveBeenCalledWith({
        where: { id: panelData.hireRequest_id },
        data: { status: 'sourcing' },
      });
  
      expect(prismaMock.candidate.updateMany).toHaveBeenCalledWith({
        where: { id: { in: panelData.candidates_id } },
        data: { pipeline_status: expect.any(String) },
      });
  
      expect(prismaMock.candidate.findMany).toHaveBeenCalledWith({
        where: { id: { in: panelData.candidates_id } },
        select: { id: true, hubspot_id: true },
      });
  
      expect(axiosPatchMock).toHaveBeenCalledTimes(5);
      panelData.candidates_id.forEach((candidateId, index) => {
        expect(axiosPatchMock).toHaveBeenCalledWith(
          `https://api.hubapi.com/crm/v3/objects/${process.env.HUBSPOT_CUSTOM_OBJECT}/hub${index + 1}`,
          { properties: { hs_pipeline_stage: expect.any(String) } },
          {
            headers: {
              Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
            },
          }
        );
      });
    });
  });
  
  describe('panelReady', () => {
    const panelData = {
      hireRequest_id: 'hr1',
      readable: true,
    };
  
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    it('should throw NotFoundException if user has no organization', async () => {
      await expect(
        service.panelReady(panelData, { ...user, organization_id: null })
      ).rejects.toThrow(NotFoundException);
    });
  
    it('should throw BadRequestException if data is missing', async () => {
      await expect(service.panelReady({} as panelReadyDTO, user))
        .rejects.toThrow(BadRequestException);
      await expect(service.panelReady({} as any, user))
        .rejects.toThrow(BadRequestException);
    });
  
    it('should throw BadRequestException if hireRequest update fails', async () => {
      prismaMock.hireRequest.update.mockResolvedValue(null);
  
      await expect(service.panelReady(panelData, user))
        .rejects.toThrow(BadRequestException);
    });
  
    it('should throw BadRequestException if panel update fails', async () => {
      prismaMock.hireRequest.update.mockResolvedValue({ id: 'hr1', status: 'panel_ready' });
      prismaMock.candidatePanel.updateMany.mockResolvedValue(null);
  
      await expect(service.panelReady(panelData, user))
        .rejects.toThrow(BadRequestException);
    });
  
    it('should throw BadRequestException if panel has less than 3 candidates', async () => {
      prismaMock.hireRequest.update.mockResolvedValue({ id: 'hr1', status: 'panel_ready' });
      prismaMock.candidatePanel.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.panelCandidate.findMany.mockResolvedValue([
        { id: 'pc1' },
        { id: 'pc2' }, // apenas 2 candidatos
      ]);
  
      await expect(service.panelReady(panelData, user))
        .rejects.toThrow(BadRequestException);
    });
  
    it('should update hireRequest, update panel, validate candidates and return true', async () => {
      prismaMock.hireRequest.update.mockResolvedValue({ id: 'hr1', status: 'panel_ready' });
      prismaMock.candidatePanel.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.panelCandidate.findMany.mockResolvedValue([
        { id: 'pc1' },
        { id: 'pc2' },
        { id: 'pc3' },
      ]); // pelo menos 3 candidatos
  
      const result = await service.panelReady(panelData, user);
      expect(result).toBe(true);
  
      expect(prismaMock.hireRequest.update).toHaveBeenCalledWith({
        where: { id: panelData.hireRequest_id },
        data: { status: 'panel_ready' },
      });
  
      expect(prismaMock.candidatePanel.updateMany).toHaveBeenCalledWith({
        where: { hire_request_id: panelData.hireRequest_id },
        data: { readable: panelData.readable },
      });
  
      expect(prismaMock.panelCandidate.findMany).toHaveBeenCalledWith({
        where: { panel_id: panelData.hireRequest_id },
      });
    });
  });
  
  describe('getPanel', () => {

    const baseId = 'hr1';
    const basePanel = { id: 'panel1' };
    const baseHireRequest = { id: 'hr1' };
    const basePanelCandidates = [
      {
        id: 'pc1',
        candidate: {
          id: 'cand1',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          country: 'Brazil',
          skills: [{ skill_name: 'React' }],
          educations: [{ institution: 'Uni', degree: 'CS', year: '2020' }],
          experiences: [
            {
              company: 'Company',
              position: 'Dev',
              responsabilities: 'Coding',
              start_date: new Date('2020-01-01'),
              end_date: new Date('2021-01-01'),
            },
          ],
        },
      },
    ];

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should throw BadRequestException if id is missing', async () => {
      await expect(service.getPanel(null as any, user)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if user is missing or has no org', async () => {
      await expect(service.getPanel(baseId, null as any)).rejects.toThrow(NotFoundException);
      await expect(service.getPanel(baseId, { ...user, organization_id: null })).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if hireRequest not found', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue(null);
      await expect(service.getPanel(baseId, user)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if panel not found', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue(baseHireRequest);
      prismaMock.candidatePanel.findFirst.mockResolvedValue(null);
      await expect(service.getPanel(baseId, user)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if panelCandidates not found', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue(baseHireRequest);
      prismaMock.candidatePanel.findFirst.mockResolvedValue(basePanel);
      prismaMock.panelCandidate.findMany.mockResolvedValue(null);
      await expect(service.getPanel(baseId, user)).rejects.toThrow(NotFoundException);
    });

    it('should return panel data with candidates', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue(baseHireRequest);
      prismaMock.candidatePanel.findFirst.mockResolvedValue(basePanel);
      prismaMock.panelCandidate.findMany.mockResolvedValue(basePanelCandidates);

      const result = await service.getPanel(baseId, user);

      expect(result).toHaveProperty('hireRequest', { id: baseId});
      expect(result).toHaveProperty('panel', { id: basePanel.id});
      expect(result.panelCandidates).toEqual(basePanelCandidates);

      expect(prismaMock.hireRequest.findUnique).toHaveBeenCalledWith({
        where: {
          id: baseId,
          org_id: user.role.includes('organization') ? user.organization_id : undefined,
        }
      });
      expect(prismaMock.candidatePanel.findFirst).toHaveBeenCalledWith({
        where: { hire_request_id: baseHireRequest.id }
      });
      expect(prismaMock.panelCandidate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { panel_id: basePanel.id },
          include: expect.any(Object),
        }),
      );
    });
  });

  describe('getPanelsByOrganization', () => {
    const organizationId = 'org1';
  
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    it('should throw NotFoundException if user has no organization', async () => {
      await expect(
        service.getPanelsByOrganization({ ...user, organization_id: null })
      ).rejects.toThrow(NotFoundException);
    });
  
    it('should throw NotFoundException if no panels found', async () => {
      prismaMock.candidatePanel.findMany.mockResolvedValue(null);
  
      await expect(service.getPanelsByOrganization(user))
        .rejects.toThrow(NotFoundException);
    });
  
    it('should throw NotFoundException if panels is empty array', async () => {
      prismaMock.candidatePanel.findMany.mockResolvedValue([]);
  
      await expect(service.getPanelsByOrganization(user))
        .rejects.toThrow(NotFoundException);
    });
  
    it('should return panels with candidates and computed years_of_experience', async () => {
      const mockResult = [
        {
          id: 'panel1',
          scheduled_date: new Date(),
          status: 'scheduled',
          panelCandidates: [
            {
              status: 'invited',
              candidate: {
                id: 'cand1',
                first_name: 'John',
                last_name: 'Doe',
                name: 'John Doe',
                hourly_pay_rate: 100,
                country: 'Brazil',
                experiences: [
                  { start_date: new Date('2016-01-01') },
                ],
              },
            },
          ],
          hireRequest: {
            id: 'hr1',
            title: 'Frontend Dev',
            description: 'React project',
            status: 'open',
            priority: 'high',
            createdAt: new Date(),
            availability: 'full-time',
            contract_length: '6 months',
            expected_start_date: new Date(),
            salary_range_from: 1000,
            salary_range_to: 2000,
            specialization: 'Frontend',
            location: 'Remote',
            assign_user_id: 'user123',
          },
        },
      ];
  
      prismaMock.candidatePanel.findMany.mockResolvedValue(mockResult);
  
      const result = await service.getPanelsByOrganization(user);
  
      // checa se years_of_experience foi calculado corretamente
      const currentYear = new Date().getFullYear();
      const expectedYears = currentYear - 2015;
  
      expect(result[0].panelCandidates[0].candidate.years_of_experience).toBe(expectedYears);
  
      // checa se o Prisma foi chamado com os selects corretos
      expect(prismaMock.candidatePanel.findMany).toHaveBeenCalledWith({
        where: {
          readable: true,
          hireRequest: {
            organization: { id: organizationId },
          },
        },
        select: {
          id: true,
          scheduled_date: true,
          status: true,
          panelCandidates: {
            select: {
              status: true,
              candidate: {
                select: {
                  id: true,
                  first_name: true,
                  last_name: true,
                  name: true,
                  hourly_pay_rate: true,
                  country: true,
                  experiences: {
                    orderBy: { start_date: 'asc' },
                    take: 1,
                    select: { start_date: true },
                  },
                },
              },
            },
          },
          hireRequest: {
            select: {
              id: true,
              title: true,
              description: true,
              status: true,
              priority: true,
              createdAt: true,
              availability: true,
              contract_length: true,
              expected_start_date: true,
              salary_range_from: true,
              salary_range_to: true,
              specialization: true,
              location: true,
              assign_user_id: true,
            },
          },
        },
      });
    });
  });

  describe('scheduleInterview', () => {
    const baseId = 'hr1';
    const baseData = {
      date: '2025-08-20',
      time: '10:30',
    };
  
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    it('should throw NotFoundException if user has no organization', async () => {
      await expect(
        service.scheduleInterview(baseId, baseData as any, { ...user, organization_id: null })
      ).rejects.toThrow(NotFoundException);
    });
  
    it('should throw NotFoundException if hireRequest not found', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue(null);
  
      await expect(service.scheduleInterview(baseId, baseData as any, user))
        .rejects.toThrow(NotFoundException);
  
      expect(prismaMock.hireRequest.findUnique).toHaveBeenCalledWith({
        where: {
          id: baseId,
          organization: { id: user.organization_id },
        },
        select: { id: true },
      });
    });
  
    it('should return true when interview scheduled successfully', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue({ id: baseId });
      prismaMock.candidatePanel.findFirst.mockResolvedValue({ id: 'panel1' });
      prismaMock.candidatePanel.update.mockResolvedValue({ count: 1 });
      prismaMock.interview.create.mockResolvedValue({ id: 'interview1' }); 
  
      const result = await service.scheduleInterview(baseId, baseData as any, user);
  
      expect(result).toBe(true);
      expect(prismaMock.candidatePanel.findFirst).toHaveBeenCalledWith({
        where: { hire_request_id: baseId },
        select: { id: true },
      });
      expect(prismaMock.candidatePanel.update).toHaveBeenCalledWith({
        where: { id: 'panel1' },
        data: {
          status: 'interview_scheduled',
        },
      });
    });
  
    it('should throw BadRequestException if update fails', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue({ id: baseId });
      prismaMock.candidatePanel.findFirst.mockResolvedValue({ id: 'panel1' });
      prismaMock.candidatePanel.update.mockResolvedValue(null);
  
      await expect(service.scheduleInterview(baseId, baseData as any, user))
        .rejects.toThrow(BadRequestException);
    });
  });
  
  describe('awaitingDecision', () => {
    const baseId = 'hr1';
    const baseData = {
      date: '2025-08-21',
      time: '14:00',
    };
  
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    it('should throw NotFoundException if user has no organization', async () => {
      await expect(
        service.awaitingDecision(baseId, baseData as any, { ...user, organization_id: null })
      ).rejects.toThrow(NotFoundException);
    });
  
    it('should throw NotFoundException if hireRequest is not found', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue(null);
  
      await expect(service.awaitingDecision(baseId, baseData as any, user))
        .rejects.toThrow(NotFoundException);
    });
  
    it('should throw NotFoundException if no panel exists for hire request', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue({ id: baseId });
      prismaMock.candidatePanel.findFirst.mockResolvedValue(null);
  
      await expect(service.awaitingDecision(baseId, baseData as any, user))
        .rejects.toThrow(NotFoundException);
    });
  
    it('should throw BadRequestException if panel update fails', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue({ id: baseId });
      prismaMock.candidatePanel.findFirst.mockResolvedValue({ id: 'panel1' });
      prismaMock.candidatePanel.update.mockResolvedValue(null);
  
      await expect(service.awaitingDecision(baseId, baseData as any, user))
        .rejects.toThrow(BadRequestException);
    });
  
    it('should throw BadRequestException if hireRequest update fails', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue({ id: baseId });
      prismaMock.candidatePanel.findFirst.mockResolvedValue({ id: 'panel1' });
      prismaMock.candidatePanel.update.mockResolvedValue({ id: 'panel1' });
      prismaMock.hireRequest.update.mockResolvedValue(null);
  
      await expect(service.awaitingDecision(baseId, baseData as any, user))
        .rejects.toThrow(BadRequestException);
    });
  
    it('should update panel and hireRequest status successfully', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue({ id: baseId });
      prismaMock.candidatePanel.findFirst.mockResolvedValue({ id: 'panel1' });
      prismaMock.candidatePanel.update.mockResolvedValue({ id: 'panel1' });
      prismaMock.hireRequest.update.mockResolvedValue({ id: baseId });
  
      const result = await service.awaitingDecision(baseId, baseData as any, user);
  
      expect(result).toBe(true);
  
      expect(prismaMock.candidatePanel.update).toHaveBeenCalledWith({
        where: { id: 'panel1' },
        data: {
          status: 'decision_pending',
          scheduled_date: new Date('2025-08-21T14:00:00.000Z'),
        },
      });
  
      expect(prismaMock.hireRequest.update).toHaveBeenCalledWith({
        where: { id: baseId },
        data: { status: 'awaiting_decision' },
      });
    });
  });
  
  describe('allowMoreTime', () => {
    const baseId = 'hr1';
    const baseData = {
      date: '2025-08-25',
      time: '16:00',
    };
  
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    it('should throw NotFoundException if user has no organization', async () => {
      await expect(
        service.allowMoreTime(baseId, baseData as any, { ...user, organization_id: null })
      ).rejects.toThrow(NotFoundException);
    });
  
    it('should throw NotFoundException if hireRequest not found', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue(null);
  
      await expect(service.allowMoreTime(baseId, baseData as any, user))
        .rejects.toThrow(NotFoundException);
  
      expect(prismaMock.hireRequest.findUnique).toHaveBeenCalledWith({
        where: {
          id: baseId,
          organization: { id: user.organization_id },
        },
        select: { id: true },
      });
    });
  
    it('should throw NotFoundException if panel does not exist', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue({ id: baseId });
      prismaMock.candidatePanel.findFirst.mockResolvedValue(null);
  
      await expect(service.allowMoreTime(baseId, baseData as any, user))
        .rejects.toThrow(NotFoundException);
    });
  
    it('should throw BadRequestException if panel update fails', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue({ id: baseId });
      prismaMock.candidatePanel.findFirst.mockResolvedValue({ id: 'panel1' });
      prismaMock.candidatePanel.update.mockResolvedValue(null);
  
      await expect(service.allowMoreTime(baseId, baseData as any, user))
        .rejects.toThrow(BadRequestException);
    });
  
    it('should update panel scheduled_date successfully', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue({ id: baseId });
      prismaMock.candidatePanel.findFirst.mockResolvedValue({ id: 'panel1' });
      prismaMock.candidatePanel.update.mockResolvedValue({ id: 'panel1' });
  
      const result = await service.allowMoreTime(baseId, baseData as any, user);
  
      expect(result).toBe(true);
      expect(prismaMock.candidatePanel.update).toHaveBeenCalledWith({
        where: { id: 'panel1' },
        data: {
          scheduled_date: new Date('2025-08-25T16:00:00.000Z'),
        },
      });
    });
  });
  
  describe('changeWinner', () => {
    const baseId = 'hr1';
    const data = { winner_id: 'cand1' };
  
    beforeEach(() => {
      jest.clearAllMocks();
      (global as any).dbToStageDictionary = {
        pipeline_stage_hired: 'Hired',
        pipeline_stage_losers: 'Available Candidates',
      };
    });
  
    it('should throw NotFoundException if user has no organization', async () => {
      await expect(
        service.changeWinner(baseId, data, { ...user, organization_id: null })
      ).rejects.toThrow(NotFoundException);
    });
  
    it('should throw NotFoundException if pipelineStatusLosers not found', async () => {
      (global as any).dbToStageDictionary = { pipeline_stage_hired: 'Hired' };
      await expect(service.changeWinner(baseId, data, user))
        .rejects.toThrow(NotFoundException);
    });
  
    it('should throw NotFoundException if pipelineStatus (Hired) not found', async () => {
      (global as any).dbToStageDictionary = { pipeline_stage_losers: 'Available Candidates' };
      await expect(service.changeWinner(baseId, data, user))
        .rejects.toThrow(NotFoundException);
    });
  
    it('should throw NotFoundException if hireRequest not found', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue(null);
  
      await expect(service.changeWinner(baseId, data, user))
        .rejects.toThrow(NotFoundException);
    });
  
    it('should throw NotFoundException if panel does not exist', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue({ id: baseId });
      prismaMock.candidatePanel.findFirst.mockResolvedValue(null);
  
      await expect(service.changeWinner(baseId, data, user))
        .rejects.toThrow(NotFoundException);
    });
  
    it('should throw NotFoundException if winner does not exist in panel', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue({ id: baseId });
      prismaMock.candidatePanel.findFirst.mockResolvedValue({ id: 'panel1' });
      prismaMock.panelCandidate.findFirst.mockResolvedValue(null);
  
      await expect(service.changeWinner(baseId, data, user))
        .rejects.toThrow(NotFoundException);
    });
  
    it('should throw NotFoundException if no losers found in panel', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue({ id: baseId });
      prismaMock.candidatePanel.findFirst.mockResolvedValue({ id: 'panel1' });
      prismaMock.panelCandidate.findFirst.mockResolvedValue({ id: 'pc1' });
      prismaMock.panelCandidate.findMany.mockResolvedValue([]); // nenhum outro candidato
  
      await expect(service.changeWinner(baseId, data, user))
        .rejects.toThrow(NotFoundException);
    });
  
    it('should throw BadRequestException if panel update fails', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue({ id: baseId });
      prismaMock.candidatePanel.findFirst.mockResolvedValue({ id: 'panel1' });
      prismaMock.panelCandidate.findFirst.mockResolvedValue({ id: 'pc1' });
      prismaMock.panelCandidate.findMany.mockResolvedValue([{ id: 'pc2', candidate: { id: 'cand2', hubspot_id: 'hub2' } }]);
      prismaMock.candidatePanel.update.mockResolvedValue(null);
  
      await expect(service.changeWinner(baseId, data, user))
        .rejects.toThrow(BadRequestException);
    });
  
    it('should throw BadRequestException if hireRequest update fails', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue({ id: baseId });
      prismaMock.candidatePanel.findFirst.mockResolvedValue({ id: 'panel1' });
      prismaMock.panelCandidate.findFirst.mockResolvedValue({ id: 'pc1' });
      prismaMock.panelCandidate.findMany.mockResolvedValue([{ id: 'pc2', candidate: { id: 'cand2', hubspot_id: 'hub2' } }]);
      prismaMock.candidatePanel.update.mockResolvedValue({ id: 'panel1' });
      prismaMock.hireRequest.update.mockResolvedValue(null);
  
      await expect(service.changeWinner(baseId, data, user))
        .rejects.toThrow(BadRequestException);
    });
  
    it('should throw BadRequestException if winner update fails', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue({ id: baseId });
      prismaMock.candidatePanel.findFirst.mockResolvedValue({ id: 'panel1' });
      prismaMock.panelCandidate.findFirst.mockResolvedValue({ id: 'pc1' });
      prismaMock.panelCandidate.findMany.mockResolvedValue([{ id: 'pc2', candidate: { id: 'cand2', hubspot_id: 'hub2' } }]);
      prismaMock.candidatePanel.update.mockResolvedValue({ id: 'panel1' });
      prismaMock.hireRequest.update.mockResolvedValue({ id: baseId });
      prismaMock.panelCandidate.updateMany.mockResolvedValueOnce(null);
  
      await expect(service.changeWinner(baseId, data, user))
        .rejects.toThrow(BadRequestException);
    });
  
    it('should throw BadRequestException if updating other candidates fails', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue({ id: baseId });
      prismaMock.candidatePanel.findFirst.mockResolvedValue({ id: 'panel1' });
      prismaMock.panelCandidate.findFirst.mockResolvedValue({ id: 'pc1' });
      prismaMock.panelCandidate.findMany.mockResolvedValue([{ id: 'pc2', candidate: { id: 'cand2', hubspot_id: 'hub2' } }]);
      prismaMock.candidatePanel.update.mockResolvedValue({ id: 'panel1' });
      prismaMock.hireRequest.update.mockResolvedValue({ id: baseId });
      prismaMock.panelCandidate.updateMany
        .mockResolvedValueOnce({ count: 1 }) // winner
        .mockResolvedValueOnce(null);        // losers
  
      await expect(service.changeWinner(baseId, data, user))
        .rejects.toThrow(BadRequestException);
    });
  
    it('should throw BadRequestException if candidate update fails', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue({ id: baseId });
      prismaMock.candidatePanel.findFirst.mockResolvedValue({ id: 'panel1' });
      prismaMock.panelCandidate.findFirst.mockResolvedValue({ id: 'pc1' });
      prismaMock.panelCandidate.findMany.mockResolvedValue([{ id: 'pc2', candidate: { id: 'cand2', hubspot_id: 'hub2' } }]);
      prismaMock.candidatePanel.update.mockResolvedValue({ id: 'panel1' });
      prismaMock.hireRequest.update.mockResolvedValue({ id: baseId });
      prismaMock.panelCandidate.updateMany
        .mockResolvedValueOnce({ count: 1 }) // winner ok
        .mockResolvedValueOnce({ count: 1 }); // losers ok
      prismaMock.candidate.update.mockResolvedValue(null);
  
      await expect(service.changeWinner(baseId, data, user))
        .rejects.toThrow(BadRequestException);
    });
  
    it('should complete successfully and call Hubspot API for winner and losers', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue({ id: baseId });
      prismaMock.candidatePanel.findFirst.mockResolvedValue({ id: 'panel1' });
      prismaMock.panelCandidate.findFirst.mockResolvedValue({ id: 'pc1' });
      prismaMock.panelCandidate.findMany.mockResolvedValue([
        { id: 'pc2', candidate: { id: 'cand2', hubspot_id: 'hub2' } },
        { id: 'pc3', candidate: { id: 'cand3', hubspot_id: 'hub3' } },
      ]);
      prismaMock.candidatePanel.update.mockResolvedValue({ id: 'panel1' });
      prismaMock.hireRequest.update.mockResolvedValue({ id: baseId });
      prismaMock.panelCandidate.updateMany
        .mockResolvedValueOnce({ count: 1 }) // winner
        .mockResolvedValueOnce({ count: 2 }); // losers
      prismaMock.candidate.update.mockResolvedValue({
        id: data.winner_id,
        hubspot_id: 'hub123',
        pipeline_status: 'pipeline_stage_hired',
      });
  
      const axiosPatchMock = jest.spyOn(axios, 'patch').mockResolvedValue({ status: 200 });
  
      const result = await service.changeWinner(baseId, data, user);
  
      expect(result).toBe(true);
  
      // check candidate updated
      expect(prismaMock.candidate.update).toHaveBeenCalledWith({
        where: { id: data.winner_id },
        data: { pipeline_status: expect.any(String) },
      });
  
      // check HubSpot API calls for losers
      expect(axiosPatchMock).toHaveBeenCalledWith(
        expect.stringContaining('hub2'),
        expect.objectContaining({ properties: { hs_pipeline_stage: expect.any(String) } }),
        expect.any(Object),
      );
      expect(axiosPatchMock).toHaveBeenCalledWith(
        expect.stringContaining('hub3'),
        expect.objectContaining({ properties: { hs_pipeline_stage: expect.any(String) } }),
        expect.any(Object),
      );
  
      // check HubSpot API call for winner
      expect(axiosPatchMock).toHaveBeenCalledWith(
        expect.stringContaining('hub123'),
        expect.objectContaining({ properties: { hs_pipeline_stage: expect.any(String) } }),
        expect.any(Object),
      );
    });
  });
  
});
