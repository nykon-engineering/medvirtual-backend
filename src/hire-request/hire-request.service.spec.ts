import { Test, TestingModule } from '@nestjs/testing';
import { HireRequestService } from './hire-request.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { USER } from '@prisma/client';
import { create } from 'domain';
import { find } from 'rxjs';
import { panelReadyDTO } from './dto/panelReady-hire-request.dto';
import { ConfirmPanelHireRequestDto } from './dto/confirm-panel-hire-request.dto';

const prismaMock = {
  hireRequest: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
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
  },
  candidate: {
    findMany: jest.fn(),
  },
  panelCandidate: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
  },
  interview: {
    create: jest.fn(),
    findMany: jest.fn(),
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
    it('should delete hire request', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue({ id: 'hr1' });
      prismaMock.hireRequest.delete.mockResolvedValue({ id: 'hr1' });

      const result = await service.remove('hr1', user);
      expect(result).toBe(true);
      expect(prismaMock.hireRequest.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if no org', async () => {
      await expect(service.remove('hr1', { ...user, organization_id: null }))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if not found', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue(null);
      await expect(service.remove('hr1', user))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if delete fails', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue({ id: 'hr1' });
      prismaMock.hireRequest.delete.mockResolvedValue(null);
      await expect(service.remove('hr1', user))
        .rejects.toThrow(BadRequestException);
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
  
    it('should reassign panel successfully', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue({ id: 'hr1' });
      prismaMock.candidatePanel.findFirst.mockResolvedValue({ id: 'panel1' });
      prismaMock.candidatePanel.updateMany.mockResolvedValue({ count: 1 });
  
      const result = await service.reassign('hr1', user, baseData);
  
      expect(result).toBe(true);
      expect(prismaMock.hireRequest.findUnique).toHaveBeenCalledWith({
        where: { id: 'hr1', organization: { id: user.organization_id } },
        select: { id: true },
      });
      expect(prismaMock.candidatePanel.findFirst).toHaveBeenCalledWith({
        where: { hire_request_id: 'hr1' },
        select: { id: true },
      });
      expect(prismaMock.candidatePanel.updateMany).toHaveBeenCalledWith({
        where: { id: 'panel1' },
        data: { user_id: 'newUser' },
      });
    });
  
    it('should throw NotFoundException if user has no organization', async () => {
      await expect(service.reassign('hr1', { ...user, organization_id: null }, baseData))
        .rejects.toThrow(NotFoundException);
    });
  
    it('should throw BadRequestException if data.user_id is missing', async () => {
      await expect(service.reassign('hr1', user, {} as any))
        .rejects.toThrow(BadRequestException);
    });
  
    it('should throw NotFoundException if hireRequest not found', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue(null);
  
      await expect(service.reassign('hr1', user, baseData))
        .rejects.toThrow(NotFoundException);
    });
  
    it('should throw NotFoundException if candidatePanel not found', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue({ id: 'hr1' });
      prismaMock.candidatePanel.findFirst.mockResolvedValue(null);
  
      await expect(service.reassign('hr1', user, baseData))
        .rejects.toThrow(NotFoundException);
    });
  
    it('should throw BadRequestException if updateMany fails', async () => {
      prismaMock.hireRequest.findUnique.mockResolvedValue({ id: 'hr1' });
      prismaMock.candidatePanel.findFirst.mockResolvedValue({ id: 'panel1' });
      prismaMock.candidatePanel.updateMany.mockResolvedValue(null);
  
      await expect(service.reassign('hr1', user, baseData))
        .rejects.toThrow(BadRequestException);
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
          organization: { id: user.organization_id },
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
      panel_id: 'panel1',
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
      await expect(service.confirmPanel({} as ConfirmPanelHireRequestDto, user)).rejects.toThrow(BadRequestException);
    });
  
    it('should throw BadRequestException if candidates_id length is not 5', async () => {
      await expect(
        service.confirmPanel({ ...panelData, candidates_id: ['cand1', 'cand2'] }, user)
      ).rejects.toThrow(BadRequestException);
    });
  
    it('should add candidates and update panel successfully', async () => {
      prismaMock.panelCandidate = {
        createMany: jest.fn().mockResolvedValue({ count: 5 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
        findMany: jest.fn().mockResolvedValue([]),
      };
      prismaMock.hireRequest.update.mockResolvedValue({ id: 'hr1', status: 'sourcing' });
  
      const result = await service.confirmPanel(panelData, user);
      expect(result).toBe(true);
  
      expect(prismaMock.panelCandidate.createMany).toHaveBeenCalledWith({
        data: panelData.candidates_id.map(candidateId => ({
          candidate_id: candidateId,
          panel_id: panelData.panel_id,
        })),
      });
  
      expect(prismaMock.hireRequest.update).toHaveBeenCalledWith({
        where: { id: panelData.hireRequest_id },
        data: { status: 'sourcing' },
      });
    });
  
    it('should throw BadRequestException if addCandidates fails', async () => {
      prismaMock.panelCandidate = {
        createMany: jest.fn().mockResolvedValue(null),
        deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
        findMany: jest.fn().mockResolvedValue([]),
      };
  
      await expect(service.confirmPanel(panelData, user)).rejects.toThrow(BadRequestException);
    });
  
    it('should throw BadRequestException if panelUpdated fails', async () => {
      prismaMock.panelCandidate = {
        createMany: jest.fn().mockResolvedValue({ count: 5 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
        findMany: jest.fn().mockResolvedValue([]),
      };
      prismaMock.hireRequest.update.mockResolvedValue(null);
  
      await expect(service.confirmPanel(panelData, user)).rejects.toThrow(BadRequestException);
    });
  });
  
  describe('editPanel', () => {
    const panelData = {
      panel_id: 'panel1',
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
      await expect(service.editPanel({} as ConfirmPanelHireRequestDto, user)).rejects.toThrow(BadRequestException);
    });
  
    it('should throw BadRequestException if candidates_id length is not 5', async () => {
      await expect(
        service.editPanel({ ...panelData, candidates_id: ['cand1'] }, user)
      ).rejects.toThrow(BadRequestException);
    });
  
    it('should remove old candidates, add new ones and update panel successfully', async () => {
      prismaMock.panelCandidate.deleteMany.mockResolvedValue({ count: 5 });
      prismaMock.panelCandidate.createMany.mockResolvedValue({ count: 5 });
      prismaMock.hireRequest.update.mockResolvedValue({ id: 'hr1', status: 'sourcing' });
  
      const result = await service.editPanel(panelData, user);
      expect(result).toBe(true);
  
      expect(prismaMock.panelCandidate.deleteMany).toHaveBeenCalledWith({
        where: { panel_id: panelData.panel_id },
      });
  
      expect(prismaMock.panelCandidate.createMany).toHaveBeenCalledWith({
        data: panelData.candidates_id.map(candidateId => ({
          candidate_id: candidateId,
          panel_id: panelData.panel_id,
        })),
      });
  
      expect(prismaMock.hireRequest.update).toHaveBeenCalledWith({
        where: { id: panelData.hireRequest_id },
        data: { status: 'sourcing' },
      });
    });
  
    it('should throw BadRequestException if removeCandidates fails', async () => {
      prismaMock.panelCandidate.deleteMany.mockResolvedValue(null);
  
      await expect(service.editPanel(panelData, user))
        .rejects.toThrow(BadRequestException);
    });
  
    it('should throw BadRequestException if addCandidates fails', async () => {
      prismaMock.panelCandidate.deleteMany.mockResolvedValue({ count: 5 });
      prismaMock.panelCandidate.createMany.mockResolvedValue(null);
  
      await expect(service.editPanel(panelData, user))
        .rejects.toThrow(BadRequestException);
    });
  
    it('should throw BadRequestException if panelUpdated fails', async () => {
      prismaMock.panelCandidate.deleteMany.mockResolvedValue({ count: 5 });
      prismaMock.panelCandidate.createMany.mockResolvedValue({ count: 5 });
      prismaMock.hireRequest.update.mockResolvedValue(null);
  
      await expect(service.editPanel(panelData, user))
        .rejects.toThrow(BadRequestException);
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
      await expect(service.panelReady({} as panelReadyDTO, user)).rejects.toThrow(BadRequestException);
      await expect(service.panelReady({} as any, user)).rejects.toThrow(BadRequestException);
    });
  
    it('should update hire request and panel successfully', async () => {
      prismaMock.hireRequest.update.mockResolvedValue({ id: 'hr1', status: 'panel_ready' });
      prismaMock.candidatePanel.updateMany.mockResolvedValue({ count: 1 });
  
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

      expect(result).toHaveProperty('hireRequestId', baseId);
      expect(result).toHaveProperty('panelId', basePanel.id);
      expect(result.panelCandidates).toEqual(basePanelCandidates);

      expect(prismaMock.hireRequest.findUnique).toHaveBeenCalledWith({
        where: {
          id: baseId,
          org_id: user.role.includes('organization') ? user.organization_id : undefined,
        },
        select: { id: true },
      });
      expect(prismaMock.candidatePanel.findFirst).toHaveBeenCalledWith({
        where: { hire_request_id: baseHireRequest.id },
        select: { id: true },
      });
      expect(prismaMock.panelCandidate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { panel_id: basePanel.id },
          include: expect.any(Object),
        }),
      );
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
  

});
