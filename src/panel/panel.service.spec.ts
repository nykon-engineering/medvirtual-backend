import { Test, TestingModule } from '@nestjs/testing';
import { PanelService } from './panel.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PanelService', () => {
  let service: PanelService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const prismaMock = {
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
      interview: {
        count: jest.fn(),
      },
      session: {
        count: jest.fn(),
      },
      candidate: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PanelService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get(PanelService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();

    (prisma.organization.count as jest.Mock).mockResolvedValue(10);
    (prisma.uSER.count as jest.Mock).mockResolvedValue(20);
    (prisma.hireRequest.count as jest.Mock).mockResolvedValue(5);
    (prisma.staff.count as jest.Mock).mockResolvedValue(12);
    (prisma.interview.count as jest.Mock).mockResolvedValue(1);
    (prisma.session.count as jest.Mock).mockResolvedValue(8);

    (prisma.candidate.count as jest.Mock)
      .mockResolvedValueOnce(7) 
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);


    (prisma.candidate.findMany as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 1,
          employment_type: '1',
          hourly_pay_rate: { toNumber: () => 10 },
          avatar_url: 'avatar.png',
          panelCandidates: [
            {
              panel: {
                hireRequest: {
                  title: 'Job A',
                  organization: { name: 'Org A' },
                },
                interviews: [],
              },
            },
          ],
        },
      ])

      .mockResolvedValueOnce([
        {
          id: 2,
          employment_type: '2',
          hourly_pay_rate: { toNumber: () => 15 },
          avatar_url: null,
          panelCandidates: [
            {
              panel: {
                hireRequest: {
                  title: 'Job B',
                  organization: { name: 'Org B' },
                },
                interviews: [],
              },
            },
          ],
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 11,
          employment_type: '1',
          hourly_pay_rate: { toNumber: () => 17 },
          avatar_url: 'img3.png',
          panelCandidates: [
            {
              panel: {
                hireRequest: {
                  title: 'Job C',
                  organization: { name: 'Org C' },
                },
                interviews: [
                  { id: 1 },
                  { id: 2 },
                  { id: 3 },
                ],
              },
            },
          ],
        },
      ]);
  });

  it('should compute and return full dashboard data', async () => {
    const result = await service.getPanelData();


    expect(result.activeOrganizations).toBe(10);
    expect(result.activeUsers).toBe(20);
    expect(result.activeHireRequests).toBe(5);
    expect(result.activeStaff).toBe(12);


    expect(result.candidatesAvailable).toBe(7);
    expect(result.candidatesEndorsed).toBe(3);
    expect(result.candidatesHired).toBe(2);

    expect(result.failedResumeParsing.length).toBe(1);
    expect(result.failedResumeParsing[0]).toHaveProperty('salary');
    expect(result.failedResumeParsing[0]).toHaveProperty('avatar');

    expect(result.withoutHeadshot.length).toBe(1);

    expect(result.monthlyData.length).toBe(12);
    expect(result.newClients.length).toBe(12);
    expect(result.userAccess.length).toBe(12);

    expect(result.moreThan5Interviews.length).toBe(1);
    expect(result.moreThan5Interviews[0].interviewCount).toBe(3);

    expect(prisma.organization.count).toHaveBeenCalled();
    expect(prisma.uSER.count).toHaveBeenCalled();
    expect(prisma.hireRequest.count).toHaveBeenCalled();
  });
});
