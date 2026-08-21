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
        findMany: jest.fn(),
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

    // 10. candidatesEndorsed (candidateAuditLog.findMany, deduped by candidate_id)
    (prisma.candidateAuditLog.findMany as jest.Mock).mockResolvedValueOnce([
      { candidate_id: 'endorsed-1' },
      { candidate_id: 'endorsed-2' },
      { candidate_id: 'endorsed-3' },
    ]);

    // 11. candidatesHired (panelCandidate.count)
    (prisma.panelCandidate.count as jest.Mock).mockResolvedValueOnce(2);

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
    
    // Prefetch for the admin/client deployment split (once for the whole range, before the loop):
    // panelCandidate.findMany (deployed candidates), candidateAuditLog.findMany (correlated audit rows)
    (prisma.panelCandidate.findMany as jest.Mock).mockResolvedValueOnce([]);
    (prisma.candidateAuditLog.findMany as jest.Mock).mockResolvedValueOnce([]);

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
      talentsDeployedByAdmin: 0,
      talentsDeployedByClient: 0,
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
    (prisma.panelCandidate.findMany as jest.Mock).mockResolvedValue([]);
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

    // Verify candidatesEndorsed filters by the audit event's own createdAt
    // (when the candidate was actually moved to "Endorsed via platform"),
    // not by an unrelated entity's creation date.
    expect(prisma.candidateAuditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
            createdAt: { gte: new Date(dateFrom), lte: new Date(dateTo) }
        })
    }));

    // Verify candidatesHired filters by PanelCandidate.updatedAt (when the
    // candidate was actually selected as winner), not by HireRequest.createdAt.
    expect(prisma.panelCandidate.count).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
            updatedAt: { gte: new Date(dateFrom), lte: new Date(dateTo) }
        })
    }));
  });

  describe('talents deployed by admin vs. client (getPanelData)', () => {
    const setupCommonMocks = () => {
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
    };

    it('counts a candidate with a client-role correlated audit row as deployed-by-client', async () => {
      setupCommonMocks();
      const deployedAt = new Date('2026-01-15T10:00:00Z');
      (prisma.panelCandidate.findMany as jest.Mock).mockResolvedValueOnce([
        { candidate_id: 'cand-1', updatedAt: deployedAt },
      ]);
      (prisma.candidateAuditLog.findMany as jest.Mock).mockImplementation(
        (args) =>
          args?.select?.actorUser
            ? Promise.resolve([
                {
                  candidate_id: 'cand-1',
                  createdAt: deployedAt,
                  actor_label: null,
                  actorUser: {
                    id: 'user-1',
                    role: 'organization_admin',
                    first_name: 'Jane',
                    last_name: 'Doe',
                  },
                },
              ])
            : Promise.resolve([]),
      );

      const result = await service.getPanelData('2026-01-01', '2026-01-31');

      const month = result.monthlyData.find(
        (m: any) => m.talentsDeployedByClient + m.talentsDeployedByAdmin > 0,
      );
      expect(month.talentsDeployedByClient).toBe(1);
      expect(month.talentsDeployedByAdmin).toBe(0);
    });

    it('counts a candidate with an admin-role correlated audit row as deployed-by-admin', async () => {
      setupCommonMocks();
      const deployedAt = new Date('2026-01-15T10:00:00Z');
      (prisma.panelCandidate.findMany as jest.Mock).mockResolvedValueOnce([
        { candidate_id: 'cand-2', updatedAt: deployedAt },
      ]);
      (prisma.candidateAuditLog.findMany as jest.Mock).mockImplementation(
        (args) =>
          args?.select?.actorUser
            ? Promise.resolve([
                {
                  candidate_id: 'cand-2',
                  createdAt: deployedAt,
                  actor_label: null,
                  actorUser: {
                    id: 'user-2',
                    role: 'system_admin',
                    first_name: 'Sam',
                    last_name: 'Admin',
                  },
                },
              ])
            : Promise.resolve([]),
      );

      const result = await service.getPanelData('2026-01-01', '2026-01-31');

      const month = result.monthlyData.find(
        (m: any) => m.talentsDeployedByClient + m.talentsDeployedByAdmin > 0,
      );
      expect(month.talentsDeployedByAdmin).toBe(1);
      expect(month.talentsDeployedByClient).toBe(0);
    });

    it('defaults to deployed-by-admin when no correlated audit row exists (e.g. admin-only manual staffing tool)', async () => {
      setupCommonMocks();
      const deployedAt = new Date('2026-01-15T10:00:00Z');
      (prisma.panelCandidate.findMany as jest.Mock).mockResolvedValueOnce([
        { candidate_id: 'cand-3', updatedAt: deployedAt },
      ]);
      (prisma.candidateAuditLog.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getPanelData('2026-01-01', '2026-01-31');

      const month = result.monthlyData.find(
        (m: any) => m.talentsDeployedByClient + m.talentsDeployedByAdmin > 0,
      );
      expect(month.talentsDeployedByAdmin).toBe(1);
      expect(month.talentsDeployedByClient).toBe(0);
    });

    it('picks the closest-in-time audit row when a candidate has multiple correlated rows, and totals still sum correctly', async () => {
      setupCommonMocks();
      const firstDeployAt = new Date('2026-01-05T10:00:00Z');
      const secondDeployAt = new Date('2026-01-20T10:00:00Z');
      (prisma.panelCandidate.findMany as jest.Mock).mockResolvedValueOnce([
        { candidate_id: 'cand-4', updatedAt: firstDeployAt },
        { candidate_id: 'cand-4', updatedAt: secondDeployAt },
      ]);
      (prisma.candidateAuditLog.findMany as jest.Mock).mockImplementation(
        (args) =>
          args?.select?.actorUser
            ? Promise.resolve([
                {
                  candidate_id: 'cand-4',
                  createdAt: firstDeployAt,
                  actor_label: null,
                  actorUser: { id: 'u-admin', role: 'system_admin', first_name: 'A', last_name: 'B' },
                },
                {
                  candidate_id: 'cand-4',
                  createdAt: secondDeployAt,
                  actor_label: null,
                  actorUser: { id: 'u-client', role: 'organization_admin', first_name: 'C', last_name: 'D' },
                },
              ])
            : Promise.resolve([]),
      );

      const result = await service.getPanelData('2026-01-01', '2026-01-31');

      const month = result.monthlyData.find(
        (m: any) => m.talentsDeployedByClient + m.talentsDeployedByAdmin > 0,
      );
      // one deployment correlates to the admin row, the other to the client row
      expect(month.talentsDeployedByAdmin).toBe(1);
      expect(month.talentsDeployedByClient).toBe(1);
      expect(
        month.talentsDeployedByAdmin + month.talentsDeployedByClient,
      ).toBe(2);
    });

    it('does not match an audit row outside the correlation window (falls through to admin default)', async () => {
      setupCommonMocks();
      const deployedAt = new Date('2026-01-15T10:00:00Z');
      const farAuditRow = new Date(deployedAt.getTime() + 60 * 60 * 1000); // 1 hour later
      (prisma.panelCandidate.findMany as jest.Mock).mockResolvedValueOnce([
        { candidate_id: 'cand-5', updatedAt: deployedAt },
      ]);
      (prisma.candidateAuditLog.findMany as jest.Mock).mockImplementation(
        (args) =>
          args?.select?.actorUser
            ? Promise.resolve([
                {
                  candidate_id: 'cand-5',
                  createdAt: farAuditRow,
                  actor_label: null,
                  actorUser: {
                    id: 'user-far',
                    role: 'organization_admin',
                    first_name: 'Far',
                    last_name: 'Away',
                  },
                },
              ])
            : Promise.resolve([]),
      );

      const result = await service.getPanelData('2026-01-01', '2026-01-31');

      const month = result.monthlyData.find(
        (m: any) => m.talentsDeployedByClient + m.talentsDeployedByAdmin > 0,
      );
      expect(month.talentsDeployedByAdmin).toBe(1);
      expect(month.talentsDeployedByClient).toBe(0);
    });
  });

  describe('getClientSelectedCandidates', () => {
    const buildPanelCandidateRow = (
      overrides: Partial<{
        id: string;
        candidate_id: string;
        updatedAt: Date;
        candidateName: string;
        orgName: string;
      }> = {},
    ) => ({
      id: overrides.id ?? 'pc-1',
      candidate_id: overrides.candidate_id ?? 'cand-1',
      updatedAt: overrides.updatedAt ?? new Date('2026-01-15T10:00:00Z'),
      candidate: {
        id: overrides.candidate_id ?? 'cand-1',
        first_name: 'Jane',
        last_name: 'Doe',
        name: overrides.candidateName ?? 'Jane Doe',
      },
      panel: {
        hireRequest: {
          id: 'hr-1',
          title: 'Bookkeeper',
          organization: { id: 'org-1', name: overrides.orgName ?? 'Acme Inc' },
        },
      },
    });

    const mockClientAuditRow = (candidateId: string, createdAt: Date) => ({
      candidate_id: candidateId,
      createdAt,
      actor_label: null,
      actorUser: {
        id: 'user-client',
        role: 'organization_admin',
        first_name: 'Jane',
        last_name: 'Client',
      },
    });

    it('returns only client-attributed rows, with pagination meta', async () => {
      const row = buildPanelCandidateRow();
      (prisma.panelCandidate.findMany as jest.Mock).mockResolvedValueOnce([row]);
      (prisma.candidateAuditLog.findMany as jest.Mock).mockResolvedValueOnce([
        mockClientAuditRow('cand-1', row.updatedAt),
      ]);

      const result = await service.getClientSelectedCandidates({
        page: 1,
        perPage: 10,
        sortBy: 'selectedAt',
        sortOrder: 'desc',
        export: false,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        candidateId: 'cand-1',
        candidateName: 'Jane Doe',
        organizationName: 'Acme Inc',
        selectedByRole: 'organization_admin',
      });
      expect(result.meta).toEqual({ total: 1, totalPages: 1, page: 1, perPage: 10 });
    });

    it('excludes admin-deployed rows (no correlated audit row)', async () => {
      const row = buildPanelCandidateRow({ id: 'pc-admin', candidate_id: 'cand-admin' });
      (prisma.panelCandidate.findMany as jest.Mock).mockResolvedValueOnce([row]);
      (prisma.candidateAuditLog.findMany as jest.Mock).mockResolvedValueOnce([]);

      const result = await service.getClientSelectedCandidates({
        page: 1,
        perPage: 10,
        export: false,
      });

      expect(result.data).toHaveLength(0);
      expect(result.meta?.total).toBe(0);
    });

    it('export=true bypasses pagination and returns the full filtered set without meta', async () => {
      const rows = Array.from({ length: 15 }, (_, i) =>
        buildPanelCandidateRow({ id: `pc-${i}`, candidate_id: `cand-${i}` }),
      );
      (prisma.panelCandidate.findMany as jest.Mock).mockResolvedValueOnce(rows);
      (prisma.candidateAuditLog.findMany as jest.Mock).mockResolvedValueOnce(
        rows.map((r) => mockClientAuditRow(r.candidate_id, r.updatedAt)),
      );

      const result = await service.getClientSelectedCandidates({
        page: 1,
        perPage: 10,
        export: true,
      });

      expect(result.data).toHaveLength(15);
      expect(result.meta).toBeUndefined();
    });

    it('sorts by candidateName when requested', async () => {
      const rowB = buildPanelCandidateRow({
        id: 'pc-b',
        candidate_id: 'cand-b',
        candidateName: 'Bob',
      });
      const rowA = buildPanelCandidateRow({
        id: 'pc-a',
        candidate_id: 'cand-a',
        candidateName: 'Amy',
      });
      (prisma.panelCandidate.findMany as jest.Mock).mockResolvedValueOnce([rowB, rowA]);
      (prisma.candidateAuditLog.findMany as jest.Mock).mockResolvedValueOnce([
        mockClientAuditRow('cand-b', rowB.updatedAt),
        mockClientAuditRow('cand-a', rowA.updatedAt),
      ]);

      const result = await service.getClientSelectedCandidates({
        page: 1,
        perPage: 10,
        sortBy: 'candidateName',
        sortOrder: 'asc',
      });

      expect(result.data.map((r) => r.candidateName)).toEqual(['Amy', 'Bob']);
    });
  });

  describe('getAdminSelectedCandidates', () => {
    const buildPanelCandidateRow = (
      overrides: Partial<{
        id: string;
        candidate_id: string;
        updatedAt: Date;
        candidateName: string;
        orgName: string;
      }> = {},
    ) => ({
      id: overrides.id ?? 'pc-1',
      candidate_id: overrides.candidate_id ?? 'cand-1',
      updatedAt: overrides.updatedAt ?? new Date('2026-01-15T10:00:00Z'),
      candidate: {
        id: overrides.candidate_id ?? 'cand-1',
        first_name: 'Jane',
        last_name: 'Doe',
        name: overrides.candidateName ?? 'Jane Doe',
      },
      panel: {
        hireRequest: {
          id: 'hr-1',
          title: 'Bookkeeper',
          organization: { id: 'org-1', name: overrides.orgName ?? 'Acme Inc' },
        },
      },
    });

    const mockAdminAuditRow = (candidateId: string, createdAt: Date) => ({
      candidate_id: candidateId,
      createdAt,
      actor_label: null,
      actorUser: {
        id: 'user-admin',
        role: 'system_admin',
        first_name: 'Alex',
        last_name: 'Admin',
      },
    });

    it('returns only admin-attributed rows, with pagination meta', async () => {
      const row = buildPanelCandidateRow();
      (prisma.panelCandidate.findMany as jest.Mock).mockResolvedValueOnce([row]);
      (prisma.candidateAuditLog.findMany as jest.Mock).mockResolvedValueOnce([
        mockAdminAuditRow('cand-1', row.updatedAt),
      ]);

      const result = await service.getAdminSelectedCandidates({
        page: 1,
        perPage: 10,
        sortBy: 'selectedAt',
        sortOrder: 'desc',
        export: false,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        candidateId: 'cand-1',
        candidateName: 'Jane Doe',
        organizationName: 'Acme Inc',
        selectedByRole: 'system_admin',
      });
      expect(result.meta).toEqual({ total: 1, totalPages: 1, page: 1, perPage: 10 });
    });

    it('includes rows with no correlated audit row (default classification is admin)', async () => {
      const row = buildPanelCandidateRow({ id: 'pc-noaudit', candidate_id: 'cand-noaudit' });
      (prisma.panelCandidate.findMany as jest.Mock).mockResolvedValueOnce([row]);
      (prisma.candidateAuditLog.findMany as jest.Mock).mockResolvedValueOnce([]);

      const result = await service.getAdminSelectedCandidates({
        page: 1,
        perPage: 10,
        export: false,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].selectedByRole).toBeNull();
    });

    it('excludes client-attributed rows', async () => {
      const row = buildPanelCandidateRow({ id: 'pc-client', candidate_id: 'cand-client' });
      (prisma.panelCandidate.findMany as jest.Mock).mockResolvedValueOnce([row]);
      (prisma.candidateAuditLog.findMany as jest.Mock).mockResolvedValueOnce([
        {
          candidate_id: 'cand-client',
          createdAt: row.updatedAt,
          actor_label: null,
          actorUser: {
            id: 'user-client',
            role: 'organization_admin',
            first_name: 'Jane',
            last_name: 'Client',
          },
        },
      ]);

      const result = await service.getAdminSelectedCandidates({
        page: 1,
        perPage: 10,
        export: false,
      });

      expect(result.data).toHaveLength(0);
      expect(result.meta?.total).toBe(0);
    });
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

  describe('getTalentAgingReport', () => {
    const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

    it('buckets candidates into 0-30/31-60/61-90/90+ by days since createdAt', async () => {
      (prisma.candidate.findMany as jest.Mock).mockResolvedValueOnce([
        { id: '1', hubspot_id: 'h1', first_name: 'Amy', last_name: 'A', name: null, pipeline_status: '261075105', approved_positions_pairing: ['Sr Bookkeeper'], createdAt: daysAgo(5) },
        { id: '2', hubspot_id: 'h2', first_name: 'Bob', last_name: 'B', name: null, pipeline_status: '261075105', approved_positions_pairing: [], createdAt: daysAgo(45) },
        { id: '3', hubspot_id: 'h3', first_name: 'Cid', last_name: 'C', name: null, pipeline_status: '1087596819', approved_positions_pairing: [], createdAt: daysAgo(75) },
        { id: '4', hubspot_id: 'h4', first_name: 'Dan', last_name: 'D', name: null, pipeline_status: '1087596819', approved_positions_pairing: [], createdAt: daysAgo(120) },
      ]);

      const result = await service.getTalentAgingReport();

      expect(result.buckets).toEqual([
        { bucket: '0-30', count: 1 },
        { bucket: '31-60', count: 1 },
        { bucket: '61-90', count: 1 },
        { bucket: '90+', count: 1 },
      ]);
      expect(result.candidates).toHaveLength(4);
    });

    it('queries only the available pool (pipeline_status in Full-Time/Part-Time)', async () => {
      (prisma.candidate.findMany as jest.Mock).mockResolvedValueOnce([]);
      await service.getTalentAgingReport();
      expect(prisma.candidate.findMany).toHaveBeenCalledWith({
        where: { pipeline_status: { in: ['261075105', '1087596819'] } },
        select: expect.objectContaining({ createdAt: true, pipeline_status: true }),
      });
    });

    it('returns all 4 buckets with zero counts when the pool is empty', async () => {
      (prisma.candidate.findMany as jest.Mock).mockResolvedValueOnce([]);
      const result = await service.getTalentAgingReport();
      expect(result.buckets.map((b) => b.count)).toEqual([0, 0, 0, 0]);
      expect(result.candidates).toEqual([]);
    });

    it('sorts candidates by daysInPool descending', async () => {
      (prisma.candidate.findMany as jest.Mock).mockResolvedValueOnce([
        { id: '1', hubspot_id: 'h1', first_name: 'Amy', last_name: null, name: null, pipeline_status: '261075105', approved_positions_pairing: [], createdAt: daysAgo(5) },
        { id: '2', hubspot_id: 'h2', first_name: 'Bob', last_name: null, name: null, pipeline_status: '261075105', approved_positions_pairing: [], createdAt: daysAgo(95) },
      ]);
      const result = await service.getTalentAgingReport();
      expect(result.candidates.map((c) => c.id)).toEqual(['2', '1']);
    });

    it('falls back to "(Unspecified)" position when approved_positions_pairing is empty', async () => {
      (prisma.candidate.findMany as jest.Mock).mockResolvedValueOnce([
        { id: '1', hubspot_id: 'h1', first_name: null, last_name: null, name: 'Fallback Name', pipeline_status: '261075105', approved_positions_pairing: [], createdAt: daysAgo(1) },
      ]);
      const result = await service.getTalentAgingReport();
      expect(result.candidates[0].position).toBe('(Unspecified)');
      expect(result.candidates[0].name).toBe('Fallback Name');
    });

    it('treats exactly 30 days as 0-30 and 31 days as 31-60 (inclusive upper boundary)', async () => {
      (prisma.candidate.findMany as jest.Mock).mockResolvedValueOnce([
        { id: '1', hubspot_id: 'h1', first_name: 'A', last_name: null, name: null, pipeline_status: '261075105', approved_positions_pairing: [], createdAt: daysAgo(30) },
        { id: '2', hubspot_id: 'h2', first_name: 'B', last_name: null, name: null, pipeline_status: '261075105', approved_positions_pairing: [], createdAt: daysAgo(31) },
      ]);
      const result = await service.getTalentAgingReport();
      expect(result.candidates.find((c) => c.id === '1')?.bucket).toBe('0-30');
      expect(result.candidates.find((c) => c.id === '2')?.bucket).toBe('31-60');
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
