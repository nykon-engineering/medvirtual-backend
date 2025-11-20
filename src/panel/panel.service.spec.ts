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
  /*
  it('getPanelData should return expected dashboard information', async () => {

    (prisma.organization.count as jest.Mock).mockResolvedValue(10);
    (prisma.uSER.count as jest.Mock).mockResolvedValue(20);
    (prisma.hireRequest.count as jest.Mock).mockResolvedValue(5);
    (prisma.staff.count as jest.Mock).mockResolvedValue(12);

    (prisma.candidate.count as jest.Mock)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(3);

    (prisma.candidate.findMany as jest.Mock)
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([{ id: 2 }]);

    const result = await service.getPanelData();

    expect(result.activeOrganizations).toBe(10);
    expect(result.activeUsers).toBe(20);
  });
  */
});
