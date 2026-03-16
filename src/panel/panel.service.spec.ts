import { Test, TestingModule } from '@nestjs/testing';
import { PanelService } from './panel.service';
import { PrismaService } from '../prisma/prisma.service';
import { PositionRateConfigService } from '../position-rate-config/position-rate-config.service';

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
        findMany: jest.fn(),
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

    const positionRateConfigMock = {
      findAll: jest.fn().mockResolvedValue({ status: 200, data: [], meta: { total: 0, page: 1, perPage: 10, totalPages: 0 } }),
      findAllUnpaginated: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PanelService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: PositionRateConfigService,
          useValue: positionRateConfigMock,
        },
      ],
    }).compile();

    service = module.get(PanelService);
    prisma = module.get(PrismaService);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should compute and return full dashboard data including new metrics', async () => {
    // ---- Mocking return values for the sequence of calls in getPanelData ----

    // 1. activeClientUsers (uSER.count)
    (prisma.uSER.count as jest.Mock).mockResolvedValueOnce(50);

    // 2. invitedClientUsers (uSER.count)
    (prisma.uSER.count as jest.Mock).mockResolvedValueOnce(45);

    // 3. verifiedClientUsers (uSER.count)
    (prisma.uSER.count as jest.Mock).mockResolvedValueOnce(15);

    // 3. completedHireRequests (hireRequest.findMany for Average Ticket Aging)
    const mockHireRequest1 = {
      createdAt: new Date('2023-01-01'),
      panels: [{ decided_date: new Date('2023-01-10') }] // 9 days diff -> ceil(9) = 9
    };
    const mockHireRequest2 = {
      createdAt: new Date('2023-02-01'),
      panels: [{ decided_date: new Date('2023-02-05') }] // 4 days diff -> ceil(4) = 4
    };
    // Average = (9 + 4) / 2 = 6.5
    (prisma.hireRequest.findMany as jest.Mock).mockResolvedValueOnce([mockHireRequest1, mockHireRequest2]);

    // 4. hrSubmittedByClient (hireRequest.count)
    (prisma.hireRequest.count as jest.Mock).mockResolvedValueOnce(12);

    // 5. activeOrganizations (organization.count)
    (prisma.organization.count as jest.Mock).mockResolvedValueOnce(10);

    // 6. activeUsers (uSER.count)
    (prisma.uSER.count as jest.Mock).mockResolvedValueOnce(20);

    // 7. activeHireRequests (hireRequest.count)
    (prisma.hireRequest.count as jest.Mock).mockResolvedValueOnce(5);

    // 8. activeStaff (staff.count)
    (prisma.staff.count as jest.Mock).mockResolvedValueOnce(12);

    // 9. candidatesAvailable (candidate.count)
    (prisma.candidate.count as jest.Mock).mockResolvedValueOnce(7);

    // 10. candidatesEndorsed (candidate.count)
    (prisma.candidate.count as jest.Mock).mockResolvedValueOnce(3);

    // 11. candidatesHired (candidate.count)
    (prisma.candidate.count as jest.Mock).mockResolvedValueOnce(2);

    // 12. failedResumeParsing (candidate.findMany)
    const mockCandidateFailed = {
      id: 1,
      employment_type: '1',
      hourly_pay_rate: { toNumber: () => 10 },
      avatar_url: 'avatar.png',
      languages: [{ name: 'English' }],
      skills: [],
      educations: [],
      approved_positions_pairing: [],
      experiences: [],
      panelCandidates: [],
    };
    (prisma.candidate.findMany as jest.Mock).mockResolvedValueOnce([mockCandidateFailed]);

    // 13. withoutHeadshot (candidate.findMany)
    const mockCandidateNoHeadshot = { ...mockCandidateFailed, id: 2, avatar_url: null };
    (prisma.candidate.findMany as jest.Mock).mockResolvedValueOnce([mockCandidateNoHeadshot]);
    
    // Loops for monthly data (12 months):
    // candidate.count (12 times)
    // hireRequest.count (12 times) -> created
    // hireRequest.count (12 times) -> endorsed
    // interview.count (12 times)
    
    // organization.count (12 times) -> new clients
    // session.count (12 times) -> access users

    for(let i=0; i<12; i++) {
        (prisma.candidate.count as jest.Mock).mockResolvedValueOnce(i + 1); // candidatesCreated
        (prisma.hireRequest.count as jest.Mock).mockResolvedValueOnce(i + 2); // hireRequestsCreated
        (prisma.hireRequest.count as jest.Mock).mockResolvedValueOnce(i); // hireRequestsEndorsed
        (prisma.interview.count as jest.Mock).mockResolvedValueOnce(i + 3); // interviewsScheduled
    }
    
    for(let i=0; i<12; i++) {
         (prisma.organization.count as jest.Mock).mockResolvedValueOnce(i + 4); // newClients
    }

    for(let i=0; i<12; i++) {
        (prisma.session.count as jest.Mock).mockResolvedValueOnce(i + 5); // accessUsers
   }

    // 14. candidatesWithInterviews (candidate.findMany)
    const mockCandidateWithInterviews = {
        ...mockCandidateFailed,
        id: 3,
        panelCandidates: [
            {
                panel: {
                    hireRequest: {
                        title: 'Job C',
                        organization: { name: 'Org C' }
                    },
                    interviews: [{}, {}, {}, {}, {}, {}] // 6 interviews
                }
            }
        ]
    };
    (prisma.candidate.findMany as jest.Mock).mockResolvedValueOnce([mockCandidateWithInterviews]);

    // Execute
    const result = await service.getPanelData();

    // Verify Legacy Metrics
    expect(result.activeOrganizations).toBe(10);
    expect(result.activeUsers).toBe(20);
    expect(result.activeHireRequests).toBe(5);
    expect(result.activeStaff).toBe(12);

    expect(result.candidatesAvailable).toBe(7);
    expect(result.candidatesEndorsed).toBe(3);
    expect(result.candidatesHired).toBe(2);

    // failedResumeParsing
    expect(result.failedResumeParsing).toHaveLength(1);

    // without headshot
    expect(result.withoutHeadshot).toHaveLength(1);

    // monthly stats
    expect(result.monthlyData).toHaveLength(12);
    expect(result.newClients).toHaveLength(12);
    expect(result.userAccess).toHaveLength(12);

    // more than 5 interviews
    expect(result.moreThan5Interviews).toHaveLength(1);
    expect(result.moreThan5Interviews[0].interviewCount).toBe(6);

    // Verify New Metrics
    expect(result.activeClientUsers).toBe(50);
    expect(result.invitedClientUsers).toBe(45);
    expect(result.averageTicketAging).toBe(6.5);
    expect(result.hrSubmittedByClient).toBe(12);
  });

  it('should apply date filters correctly', async () => {
    const dateFrom = '2023-01-01';
    const dateTo = '2023-01-31';

    // Setup mocks to return empty/zero values to avoid execution errors
    (prisma.uSER.count as jest.Mock).mockResolvedValue(0); 
    (prisma.hireRequest.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.hireRequest.count as jest.Mock).mockResolvedValue(0);
    (prisma.organization.count as jest.Mock).mockResolvedValue(0);
    (prisma.staff.count as jest.Mock).mockResolvedValue(0);
    (prisma.candidate.count as jest.Mock).mockResolvedValue(0);
    (prisma.candidate.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.interview.count as jest.Mock).mockResolvedValue(0);
    (prisma.session.count as jest.Mock).mockResolvedValue(0);

    await service.getPanelData(dateFrom, dateTo);

    // Verify activeClientUsers date filter
    expect(prisma.uSER.count).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
             createdAt: { gte: new Date(dateFrom), lte: new Date(dateTo) }
        })
    }));

    // Verify aging date filter
    expect(prisma.hireRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
            panels: {
                some: expect.objectContaining({
                    decided_date: {
                        gte: new Date(dateFrom),
                        lte: new Date(dateTo)
                    }
                })
            }
        })
    }));

    // Verify hrSubmittedByClient date filter
    expect(prisma.hireRequest.count).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
             createdAt: {
                gte: new Date(dateFrom),
                lte: new Date(dateTo)
             }
        })
    }));
  });
});
