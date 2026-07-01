import { Test, TestingModule } from '@nestjs/testing';
import { BillComAuthService } from './bill-com-auth.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma = {
  uSER: {
    findUniqueOrThrow: jest.fn(),
  },
};

describe('BillComAuthService', () => {
  let service: BillComAuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillComAuthService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BillComAuthService>(BillComAuthService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('determineNextStep', () => {
    it('returns "proceed" when the login was trusted', async () => {
      const step = await service.determineNextStep('admin-1', {
        sessionId: 'sess-1',
        trusted: true,
      });
      expect(step).toBe('proceed');
      expect(mockPrisma.uSER.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it('returns "mfa_challenge" when untrusted and the admin already has a device on file', async () => {
      mockPrisma.uSER.findUniqueOrThrow.mockResolvedValue({
        billcom_device: 'MedVirtual Admin - admin@medvirtual.ai',
      });

      const step = await service.determineNextStep('admin-1', {
        sessionId: 'sess-1',
        trusted: false,
      });

      expect(step).toBe('mfa_challenge');
    });

    it('returns "phone_setup" when untrusted and the admin has no device on file', async () => {
      mockPrisma.uSER.findUniqueOrThrow.mockResolvedValue({
        billcom_device: null,
      });

      const step = await service.determineNextStep('admin-1', {
        sessionId: 'sess-1',
        trusted: false,
      });

      expect(step).toBe('phone_setup');
    });
  });
});
