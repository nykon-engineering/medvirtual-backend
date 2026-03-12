import { Test, TestingModule } from '@nestjs/testing';
import { PositionRateConfigService } from './position-rate-config.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  positionRateConfig: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};

describe('PositionRateConfigService', () => {
  let service: PositionRateConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PositionRateConfigService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PositionRateConfigService>(PositionRateConfigService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all configs ordered by position asc', async () => {
      const mockData = [
        { position: 'Admin VA', medVirtual_floor_price_english: 15, medVirtual_margin_per_hour: 5 },
        { position: 'Billing VA', medVirtual_floor_price_english: 18, medVirtual_margin_per_hour: 6 },
      ];
      mockPrisma.positionRateConfig.findMany.mockResolvedValue(mockData);

      const result = await service.findAll();

      expect(mockPrisma.positionRateConfig.findMany).toHaveBeenCalledWith({
        orderBy: { position: 'asc' },
      });
      expect(result).toEqual(mockData);
    });

    it('returns empty array when no configs exist', async () => {
      mockPrisma.positionRateConfig.findMany.mockResolvedValue([]);
      const result = await service.findAll();
      expect(result).toEqual([]);
    });
  });

  describe('findByPosition', () => {
    it('returns config for a specific position', async () => {
      const mockConfig = { position: 'Admin VA', medVirtual_floor_price_english: 15 };
      mockPrisma.positionRateConfig.findUnique.mockResolvedValue(mockConfig);

      const result = await service.findByPosition('Admin VA');

      expect(mockPrisma.positionRateConfig.findUnique).toHaveBeenCalledWith({
        where: { position: 'Admin VA' },
      });
      expect(result).toEqual(mockConfig);
    });

    it('returns null when position not found', async () => {
      mockPrisma.positionRateConfig.findUnique.mockResolvedValue(null);
      const result = await service.findByPosition('Unknown');
      expect(result).toBeNull();
    });
  });

  describe('upsert', () => {
    const dto = {
      medVirtual_floor_price_english: 15,
      berryVirtual_floor_price_english: 15,
      medVirtual_floor_price_bilingual: 17,
      berryVirtual_floor_price_bilingual: 17,
      medVirtual_margin_per_hour: 9,
      berryVirtual_margin_per_hour: 9,
    };

    it('calls prisma upsert with correct create/update payloads', async () => {
      const saved = { position: 'Admin VA', ...dto };
      mockPrisma.positionRateConfig.upsert.mockResolvedValue(saved);

      const result = await service.upsert('Admin VA', dto);

      expect(mockPrisma.positionRateConfig.upsert).toHaveBeenCalledWith({
        where: { position: 'Admin VA' },
        update: {
          medVirtual_floor_price_english: 15,
          berryVirtual_floor_price_english: 15,
          medVirtual_floor_price_bilingual: 17,
          berryVirtual_floor_price_bilingual: 17,
          medVirtual_margin_per_hour: 9,
          berryVirtual_margin_per_hour: 9,
        },
        create: {
          position: 'Admin VA',
          medVirtual_floor_price_english: 15,
          berryVirtual_floor_price_english: 15,
          medVirtual_floor_price_bilingual: 17,
          berryVirtual_floor_price_bilingual: 17,
          medVirtual_margin_per_hour: 9,
          berryVirtual_margin_per_hour: 9,
        },
      });
      expect(result).toEqual(saved);
    });

    it('passes undefined for unspecified fields (Prisma will skip updating them)', async () => {
      const partialDto = { medVirtual_margin_per_hour: 6 };
      mockPrisma.positionRateConfig.upsert.mockResolvedValue({});

      await service.upsert('Admin VA', partialDto);

      const call = mockPrisma.positionRateConfig.upsert.mock.calls[0][0];
      expect(call.update.medVirtual_floor_price_english).toBeUndefined();
      expect(call.update.berryVirtual_floor_price_english).toBeUndefined();
      expect(call.update.medVirtual_margin_per_hour).toBe(6);
    });
  });
});
