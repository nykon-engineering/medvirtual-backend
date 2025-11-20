import { Test, TestingModule } from '@nestjs/testing';
import { PanelService } from './panel.service';
import { PrismaService } from '../prisma/prisma.service';
import { HireRequestStatus, OrganizationStatus } from '@prisma/client';

describe('PanelService', () => {
  let service: PanelService;
  let prisma: jest.Mocked<PrismaService>;

  const mockPrismaService = {
    organization: {
      count: jest.fn(),
    },
    uSER: {
      count: jest.fn(),
    },
    hireRequest: {
      count: jest.fn(),
    },
    staff: {
      count: jest.fn(),
    },
    candidate: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    interview: {
      count: jest.fn(),
    },
    session: {
      count: jest.fn(),
    },
  } as unknown as jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PanelService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PanelService>(PanelService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('getPanelData should fully compute dashboard metrics', async () => {

    (prisma.organization.count as jest.Mock).mockResolvedValue(10);
    (prisma.uSER.count as jest.Mock).mockResolvedValue(20);
    (prisma.hireRequest.count as jest.Mock).mockResolvedValue(5);
    (prisma.staff.count as jest.Mock).mockResolvedValue(12);

    (prisma.candidate.count as jest.Mock)
      .mockResolvedValueOnce(7)  
      .mockResolvedValueOnce(3); 

    (prisma.candidate.findMany as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 1,
          hourly_pay_rate: { toNumber: () => 10 },
          avatar_url: 'img.png',
          panelCandidates: [
            {
              panel: {
                hireRequest: {
                  title: 'Job X',
                  organization: { name: 'Org A' },
                },
              },
            },
          ],
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 2,
          hourly_pay_rate: { toNumber: () => 12 },
          avatar_url: 'img2.png',
          panelCandidates: [
            {
              panel: {
                hireRequest: {
                  title: 'Job Y',
                  organization: { name: 'Org B' },
                },
              },
            },
          ],
        },
      ]);


    (prisma.hireRequest.count as jest.Mock)
    .mockResolvedValueOnce(5)
    .mockResolvedValue(2);
    (prisma.interview.count as jest.Mock).mockResolvedValue(1);
    
    (prisma.session.count as jest.Mock).mockResolvedValue(8);
    (prisma.organization.count as jest.Mock).mockResolvedValue(10);


    const monthlyCandidateCounts = Array(12).fill(4);
    (prisma.candidate.count as jest.Mock).mockImplementation(() => {
      return Promise.resolve(monthlyCandidateCounts.shift() ?? 4);
    });

    const result = await service.getPanelData();

    expect(result.activeOrganizations).toBe(10);
    expect(result.activeUsers).toBe(20);
    expect(result.activeHireRequests).toBe(5);
    expect(result.activeStaff).toBe(12);

    expect(result.candidatesAvailable).toBe(7);
    expect(result.candidatesEndorsed).toBe(3);

    expect(result.failedResumeParsing.length).toBe(1);
    expect(result.withoutHeadshot.length).toBe(1);

    expect(result.monthlyData.length).toBe(12);
    result.monthlyData.forEach((m) => {
      expect(m).toHaveProperty('month');
      expect(m).toHaveProperty('candidates');
      expect(m).toHaveProperty('hireRequests');
      expect(m).toHaveProperty('interviews');
    });

    expect(result.newClients.length).toBe(12);
    result.newClients.forEach((m) => {
      expect(m).toHaveProperty('month');
      expect(m).toHaveProperty('newClients');
    });

    expect(result.userAccess.length).toBe(12);
    result.userAccess.forEach((m) => {
      expect(m).toHaveProperty('month');
      expect(m).toHaveProperty('accessUsers');
    });
  });
});
