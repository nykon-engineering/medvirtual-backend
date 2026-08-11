import { Test, TestingModule } from '@nestjs/testing';
import { StripeService } from './stripe.service';
import { ConfigService } from '@nestjs/config';
import { SecretsService } from '../secrets/secrets.service';
import { PrismaService } from '../prisma/prisma.service';
import { PusherService } from '../pusher/pusher.service';
import { InvoiceService } from '../invoice/invoice.service';
import { getQueueToken } from '@nestjs/bullmq';

// Mock Stripe library
const mockWebhookEndpointsList = jest.fn();
const mockWebhookEndpointsDel = jest.fn();
const mockWebhookEndpointsCreate = jest.fn();
const mockConstructEvent = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => {
    return {
      webhookEndpoints: {
        list: mockWebhookEndpointsList,
        del: mockWebhookEndpointsDel,
        create: mockWebhookEndpointsCreate,
      },
      webhooks: {
        constructEvent: mockConstructEvent,
      },
    };
  });
});

describe('StripeService', () => {
  let service: StripeService;
  let redisMock: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'REDIS_BASE_KEY') return 'MEDVIRTUAL:LOCAL:';
        if (key === 'STRIPE_SECRET_KEY') return 'sk_test_mock';
        if (key === 'STRIPE_PUBLIC_KEY') return 'pk_test_mock';
        if (key === 'WEBHOOK_URL') return 'https://webhook.test';
        return defaultValue;
      }),
    };

    const mockSecretsService = {
      getSecret: jest.fn(),
    };

    redisMock = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: SecretsService, useValue: mockSecretsService },
        { provide: 'REDIS_CLIENT', useValue: redisMock },
        { provide: PrismaService, useValue: {} },
        { provide: PusherService, useValue: {} },
        { provide: getQueueToken('invoice'), useValue: {} },
        { provide: getQueueToken('invoice-prebill-reconciliation'), useValue: {} },
        { provide: InvoiceService, useValue: {} },
      ],
    }).compile();

    service = module.get<StripeService>(StripeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPublicKey', () => {
    it('should return public key', async () => {
      await (service as any).initializeStripe();
      expect(service.getPublicKey()).toBe('pk_test_mock');
    });
  });

  describe('initiateWebhookHandler', () => {
    it('should skip setup if stripe not initialized', async () => {
      (service as any).stripe = null;
      const res = await service.initiateWebhookHandler();
      expect(res).toBeUndefined();
    });

    it('should create new webhook if none exists', async () => {
      await (service as any).initializeStripe();
      mockWebhookEndpointsList.mockResolvedValueOnce({ data: [] });
      mockWebhookEndpointsCreate.mockResolvedValueOnce({
        id: 'wh_123',
        secret: 'whsec_123',
      });

      await service.initiateWebhookHandler();

      expect(mockWebhookEndpointsCreate).toHaveBeenCalled();
      expect(redisMock.set).toHaveBeenCalledWith(
        'MEDVIRTUAL:LOCAL::stripe_webhook_secret',
        'whsec_123'
      );
    });
  });
});
