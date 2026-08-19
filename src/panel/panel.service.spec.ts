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
      sessionActivity: {
        findMany: jest.fn(),
      },
      candidate: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      panelCandidate: {
        count: jest.fn(),
      },
      candidateAuditLog: {
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
        (prisma.panelCandidate.count as jest.Mock).mockResolvedValueOnce(i + 6); // talentsSelectedAsWinner
        (prisma.candidateAuditLog.findMany as jest.Mock).mockResolvedValueOnce(
          Array.from({ length: i + 1 }, (_, j) => ({ candidate_id: `c-${i}-${j}` })),
        ); // talentsRemoved
        (prisma.candidateAuditLog.findMany as jest.Mock).mockResolvedValueOnce(
          Array.from({ length: i + 2 }, (_, j) => ({ candidate_id: `e-${i}-${j}` })),
        ); // talentsEndorsed
    }
    
    for(let i=0; i<12; i++) {
         (prisma.organization.count as jest.Mock).mockResolvedValueOnce(i + 4); // newClients
    }

    for(let i=0; i<12; i++) {
        (prisma.session.count as jest.Mock).mockResolvedValueOnce(i + 5); // accessUsers
   }

    // Client engagement / admin usage loop (12 months):
    // session.count (client logins), sessionActivity.findMany (talent pool pings),
    // session.count (admin logins), sessionActivity.findMany (platform pings)
    (prisma.session.count as jest.Mock).mockResolvedValue(1);
    (prisma.sessionActivity.findMany as jest.Mock).mockResolvedValue([]);

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
    expect(result.clientEngagement).toHaveLength(12);
    expect(result.adminUsage).toHaveLength(12);
    expect(result.monthlyData[0]).toEqual({
      month: expect.any(String),
      candidates: 1,
      hireRequests_created: 2,
      hireRequests_endorsed: 0,
      interviews: 3,
      talentsSelectedAsWinner: 6,
      talentsRemoved: 1,
      talentsEndorsed: 2,
    });
    expect(result.clientEngagement[0]).toEqual({
      month: expect.any(String),
      clientLogins: 1,
      talentPoolDurationMinutes: 0,
    });
    expect(result.adminUsage[0]).toEqual({
      month: expect.any(String),
      adminLogins: 1,
      platformDurationMinutes: 0,
    });

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
    (prisma.sessionActivity.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.panelCandidate.count as jest.Mock).mockResolvedValue(0);
    (prisma.candidateAuditLog.findMany as jest.Mock).mockResolvedValue([]);

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

  describe('getTalentAvailabilityByRole', () => {
    it('aggregates counts by position, splitting full-time and part-time', async () => {
      (prisma.candidate.findMany as jest.Mock).mockResolvedValueOnce([
        { pipeline_status: '261075105', approved_positions_pairing: ['Sr Bookkeeper'] },
        { pipeline_status: '261075105', approved_positions_pairing: ['Sr Bookkeeper'] },
        { pipeline_status: '1087596819', approved_positions_pairing: ['Sr Bookkeeper'] },
      ]);

      const result = await service.getTalentAvailabilityByRole();

      expect(result).toEqual([
        expect.objectContaining({ fullTime: 2, partTime: 1, total: 3 }),
      ]);
      expect(prisma.candidate.findMany).toHaveBeenCalledWith({
        where: { pipeline_status: { in: ['261075105', '1087596819'] } },
        select: { pipeline_status: true, approved_positions_pairing: true },
      });
    });

    it('counts a candidate once per position when approved for multiple roles', async () => {
      (prisma.candidate.findMany as jest.Mock).mockResolvedValueOnce([
        { pipeline_status: '261075105', approved_positions_pairing: ['Sr Bookkeeper', 'Jr Medical Admin'] },
      ]);

      const result = await service.getTalentAvailabilityByRole();

      expect(result).toHaveLength(2);
      expect(result.every((r) => r.fullTime === 1 && r.total === 1)).toBe(true);
    });

    it('falls back to "(Unspecified)" when a candidate has no approved positions', async () => {
      (prisma.candidate.findMany as jest.Mock).mockResolvedValueOnce([
        { pipeline_status: '261075105', approved_positions_pairing: [] },
      ]);

      const result = await service.getTalentAvailabilityByRole();

      expect(result).toEqual([
        expect.objectContaining({ position: '(Unspecified)', fullTime: 1, total: 1 }),
      ]);
    });

    it('sorts results by total descending', async () => {
      (prisma.candidate.findMany as jest.Mock).mockResolvedValueOnce([
        { pipeline_status: '261075105', approved_positions_pairing: ['Jr Medical Admin'] },
        { pipeline_status: '261075105', approved_positions_pairing: ['Sr Bookkeeper'] },
        { pipeline_status: '261075105', approved_positions_pairing: ['Sr Bookkeeper'] },
      ]);

      const result = await service.getTalentAvailabilityByRole();

      expect(result[0].total).toBeGreaterThanOrEqual(result[1].total);
    });
  });

  describe('getScopedDurationMinutes', () => {
    const monthStart = new Date('2026-01-01');
    const monthEnd = new Date('2026-02-01');
    const minute = (n: number) => new Date(monthStart.getTime() + n * 60_000);

    it('sums consecutive pings within the idle-gap tolerance', async () => {
      // Pings 1 minute apart, 5 in a row => 4 gaps of 1 minute each = 4 minutes.
      (prisma.sessionActivity.findMany as jest.Mock).mockResolvedValueOnce([
        { userId: 'u1', pingedAt: minute(0) },
        { userId: 'u1', pingedAt: minute(1) },
        { userId: 'u1', pingedAt: minute(2) },
        { userId: 'u1', pingedAt: minute(3) },
        { userId: 'u1', pingedAt: minute(4) },
      ]);

      const result = await (service as any).getScopedDurationMinutes(
        monthStart,
        monthEnd,
        'platform',
        ['system_admin'],
      );

      expect(result).toBe(4);
    });

    it('excludes gaps larger than 2x the heartbeat interval (idle/closed tab)', async () => {
      // 0 -> 1 counts (1 min gap), 1 -> 30 does not (29 min gap, tab went idle/closed).
      (prisma.sessionActivity.findMany as jest.Mock).mockResolvedValueOnce([
        { userId: 'u1', pingedAt: minute(0) },
        { userId: 'u1', pingedAt: minute(1) },
        { userId: 'u1', pingedAt: minute(30) },
      ]);

      const result = await (service as any).getScopedDurationMinutes(
        monthStart,
        monthEnd,
        'platform',
        ['system_admin'],
      );

      expect(result).toBe(1);
    });

    it('sums durations independently per user', async () => {
      (prisma.sessionActivity.findMany as jest.Mock).mockResolvedValueOnce([
        { userId: 'u1', pingedAt: minute(0) },
        { userId: 'u1', pingedAt: minute(2) },
        { userId: 'u2', pingedAt: minute(0) },
        { userId: 'u2', pingedAt: minute(1) },
      ]);

      const result = await (service as any).getScopedDurationMinutes(
        monthStart,
        monthEnd,
        'talent_pool',
        ['organization_admin'],
      );

      // u1: 2 minutes, u2: 1 minute => 3 total
      expect(result).toBe(3);
    });

    it('returns 0 when there are no pings', async () => {
      (prisma.sessionActivity.findMany as jest.Mock).mockResolvedValueOnce([]);

      const result = await (service as any).getScopedDurationMinutes(
        monthStart,
        monthEnd,
        'platform',
        ['system_admin'],
      );

      expect(result).toBe(0);
    });
  });
});
