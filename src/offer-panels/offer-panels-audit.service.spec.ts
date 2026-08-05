import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import {
  OfferPanelsAuditService,
  OFFER_PANEL_AUDIT_EVENTS,
  recipientActorLabel,
} from './offer-panels-audit.service';

const mockPrisma = {
  offerPanelAuditLog: {
    create: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('OfferPanelsAuditService', () => {
  let service: OfferPanelsAuditService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OfferPanelsAuditService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<OfferPanelsAuditService>(OfferPanelsAuditService);
  });

  describe('log', () => {
    it('writes the row with snake_case columns and a defaulted source', async () => {
      mockPrisma.offerPanelAuditLog.create.mockResolvedValue({});

      await service.log({
        offerPanelId: 'panel-1',
        actorUserId: 'user-1',
        actorLabel: 'Admin User',
        event: OFFER_PANEL_AUDIT_EVENTS.CREATED,
        newStatus: 'sent',
      });

      expect(mockPrisma.offerPanelAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          offer_panel_id: 'panel-1',
          actor_user_id: 'user-1',
          actor_label: 'Admin User',
          event: 'created',
          new_status: 'sent',
          old_status: null,
          source: 'user',
        }),
      });
    });

    // Prisma must omit absent JSON fields rather than write a JSON null.
    it('passes undefined, not null, for absent JSON fields', async () => {
      mockPrisma.offerPanelAuditLog.create.mockResolvedValue({});

      await service.log({
        offerPanelId: 'panel-1',
        event: OFFER_PANEL_AUDIT_EVENTS.VIEWED,
      });

      const { data } = mockPrisma.offerPanelAuditLog.create.mock.calls[0][0];
      expect(data.before).toBeUndefined();
      expect(data.after).toBeUndefined();
      expect(data.metadata).toBeUndefined();
    });

    // A broken audit write must never fail a working panel operation.
    it('swallows a failing insert', async () => {
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockPrisma.offerPanelAuditLog.create.mockRejectedValue(
        new Error('db down'),
      );

      await expect(
        service.log({
          offerPanelId: 'panel-1',
          event: OFFER_PANEL_AUDIT_EVENTS.CREATED,
        }),
      ).resolves.toBeUndefined();

      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe('logOrThrow', () => {
    // Compliance events must not be silently lost.
    it('propagates a failing insert', async () => {
      mockPrisma.offerPanelAuditLog.create.mockRejectedValue(
        new Error('db down'),
      );

      await expect(
        service.logOrThrow({
          offerPanelId: 'panel-1',
          event: OFFER_PANEL_AUDIT_EVENTS.DELETED,
        }),
      ).rejects.toThrow('db down');
    });

    it('writes through the transaction client when one is given', async () => {
      const txCreate = jest.fn().mockResolvedValue({});
      const tx = { offerPanelAuditLog: { create: txCreate } } as any;

      await service.logOrThrow(
        { offerPanelId: 'panel-1', event: OFFER_PANEL_AUDIT_EVENTS.DELETED },
        tx,
      );

      expect(txCreate).toHaveBeenCalled();
      expect(mockPrisma.offerPanelAuditLog.create).not.toHaveBeenCalled();
    });
  });

  describe('findByOfferPanel', () => {
    it('returns the timeline oldest first', async () => {
      mockPrisma.offerPanelAuditLog.findMany.mockResolvedValue([]);

      await service.findByOfferPanel('panel-1');

      expect(mockPrisma.offerPanelAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { offer_panel_id: 'panel-1' },
          orderBy: { createdAt: 'asc' },
        }),
      );
    });
  });

  describe('findAllLogs', () => {
    // `origin` lives inside the metadata JSON rather than its own column.
    it('filters origin through the metadata JSON path', async () => {
      mockPrisma.offerPanelAuditLog.count.mockResolvedValue(0);
      mockPrisma.offerPanelAuditLog.findMany.mockResolvedValue([]);

      await service.findAllLogs({ origin: 'public_token' } as any);

      expect(mockPrisma.offerPanelAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            metadata: { path: ['origin'], equals: 'public_token' },
          }),
        }),
      );
    });
  });

  describe('recipientActorLabel', () => {
    it('names the recipient when one is known', () => {
      expect(recipientActorLabel('Jane Client')).toBe(
        'Jane Client (offer panel recipient)',
      );
    });

    it('falls back to a generic label for a blank name', () => {
      expect(recipientActorLabel('   ')).toBe('Offer panel recipient');
      expect(recipientActorLabel(null)).toBe('Offer panel recipient');
    });
  });
});
