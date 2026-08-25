import { Test, TestingModule } from '@nestjs/testing';
import { DealsQueueConsumerService } from './deals-queue-consumer.service';
import { HandlerDealCreation } from '../hubspot/handlers/dealCreation';
import { PrismaService } from '../prisma/prisma.service';

describe('DealsQueueConsumerService', () => {
  let service: DealsQueueConsumerService;
  let dealCreation: HandlerDealCreation;
  let prismaService: PrismaService;

  const mockDealCreation = {
    execute: jest.fn(),
  };

  const mockPrismaService = {
    staff: {
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DealsQueueConsumerService,
        { provide: HandlerDealCreation, useValue: mockDealCreation },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<DealsQueueConsumerService>(DealsQueueConsumerService);
    dealCreation = module.get<HandlerDealCreation>(HandlerDealCreation);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleMessage', () => {
    it('should create staff when type is CREATE_DEAL_STAFF', async () => {
      const payload = { Type: 'CREATE_DEAL_STAFF', objectId: '123' };

      await service.handleMessage(JSON.stringify(payload));

      expect(dealCreation.execute).toHaveBeenCalledWith(payload);
    });

    it('should deactivate staff when type is DEACTIVATE_STAFF', async () => {
      const payload = { Type: 'DEACTIVATE_STAFF', objectId: '123' };

      await service.handleMessage(JSON.stringify(payload));

      expect(prismaService.staff.update).toHaveBeenCalledWith({
        where: { hubspot_id: '123' },
        data: { status: 'terminated' },
      });
    });

    it('should reactivate staff when type is REACTIVATE_STAFF', async () => {
      const payload = { Type: 'REACTIVATE_STAFF', objectId: '123' };

      await service.handleMessage(JSON.stringify(payload));

      expect(prismaService.staff.update).toHaveBeenCalledWith({
        where: { hubspot_id: '123' },
        data: { status: 'active' },
      });
    });

    it('should handle a double-encoded JSON body', async () => {
      const payload = { Type: 'CREATE_DEAL_STAFF', objectId: '123' };

      await service.handleMessage(JSON.stringify(JSON.stringify(payload)));

      expect(dealCreation.execute).toHaveBeenCalledWith(payload);
    });

    it('should not call any handler for an unknown type', async () => {
      const payload = { Type: 'UNKNOWN_TYPE', objectId: '123' };

      await service.handleMessage(JSON.stringify(payload));

      expect(dealCreation.execute).not.toHaveBeenCalled();
      expect(prismaService.staff.update).not.toHaveBeenCalled();
    });
  });
});
