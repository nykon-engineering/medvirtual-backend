import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BusinessUnitsService } from './business-units.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BU = {
  id: 'bu-1',
  slug: 'medvirtual',
  name: 'MedVirtual',
  is_active: true,
  created_at: new Date('2026-01-01'),
  created_by: 'user-1',
};

const BRANDING = {
  id: 'brand-1',
  business_unit: 'medvirtual',
  primary_color: '#01546B',
  secondary_color: '#013A4F',
  logo_url: 'https://staging.medvirtual.ai/logo.png',
  company_name: 'MedVirtual',
  layout_preset: 'default',
  button_color: null,
  button_text_color: null,
  updated_by: 'user-1',
  updated_at: new Date('2026-01-01'),
};

const BRANDING_HISTORY = {
  id: 'bh-1',
  branding_id: 'brand-1',
  snapshot: { primary_color: '#01546B' },
  changed_by: 'user-1',
  changed_at: new Date('2026-01-01'),
};

// ── Mock factory ──────────────────────────────────────────────────────────────

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    businessUnit: {
      findUnique: jest.fn().mockResolvedValue(BU),
      findMany: jest.fn().mockResolvedValue([BU]),
      create: jest.fn().mockResolvedValue(BU),
      update: jest.fn().mockResolvedValue({ ...BU }),
    },
    emailBranding: {
      findUnique: jest.fn().mockResolvedValue(BRANDING),
      create: jest.fn().mockResolvedValue(BRANDING),
      update: jest.fn().mockResolvedValue(BRANDING),
    },
    emailBrandingHistory: {
      create: jest.fn().mockResolvedValue(BRANDING_HISTORY),
      findMany: jest.fn().mockResolvedValue([BRANDING_HISTORY]),
    },
    ...overrides,
  };
}

function makeService(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = makePrisma(prismaOverrides);
  const service = new (BusinessUnitsService as any)(prisma);
  return { service: service as BusinessUnitsService, prisma };
}

// ── findAll ────────────────────────────────────────────────────────────────────

describe('BusinessUnitsService.findAll', () => {
  it('returns all business units with branding included', async () => {
    const { service } = makeService();
    const result = await service.findAll();
    expect(result.status).toBe(200);
    expect(Array.isArray(result.data)).toBe(true);
  });
});

// ── create ─────────────────────────────────────────────────────────────────────

describe('BusinessUnitsService.create', () => {
  const dto = { slug: 'mmva', name: 'MMVA' };

  it('creates the BU and its default EmailBranding in a single transaction', async () => {
    const prisma = makePrisma({
      businessUnit: {
        findUnique: jest.fn().mockResolvedValue(null), // no existing BU
        create: jest.fn().mockResolvedValue({ ...BU, slug: 'mmva', name: 'MMVA' }),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    });
    const service = new (BusinessUnitsService as any)(prisma) as BusinessUnitsService;

    await service.create(dto, 'user-1');

    expect(prisma.$transaction).toHaveBeenCalled();
    const txArgs = (prisma.$transaction as jest.Mock).mock.calls[0][0] as unknown[];
    expect(txArgs).toHaveLength(2);
  });

  it('auto-creates EmailBranding with the BU name as company_name', async () => {
    const prisma = makePrisma({
      businessUnit: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ ...BU, slug: 'mmva', name: 'MMVA' }),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    });
    const service = new (BusinessUnitsService as any)(prisma) as BusinessUnitsService;

    await service.create(dto, 'user-1');

    expect(prisma.emailBranding.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ company_name: 'MMVA', business_unit: 'mmva' }),
      }),
    );
  });

  it('throws BadRequestException when slug already exists', async () => {
    const { service } = makeService(); // findUnique returns BU by default
    await expect(service.create(dto, 'user-1')).rejects.toThrow(BadRequestException);
  });
});

// ── update ─────────────────────────────────────────────────────────────────────

describe('BusinessUnitsService.update', () => {
  it('updates name when provided', async () => {
    const { service, prisma } = makeService();
    await service.update('medvirtual', { name: 'MedVirtual Renamed' });
    expect(prisma.businessUnit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: 'medvirtual' },
        data: expect.objectContaining({ name: 'MedVirtual Renamed' }),
      }),
    );
  });

  it('throws NotFoundException for unknown slug', async () => {
    const { service } = makeService({
      businessUnit: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
    });
    await expect(service.update('ghost', { name: 'X' })).rejects.toThrow(NotFoundException);
  });
});

// ── deactivate ─────────────────────────────────────────────────────────────────

describe('BusinessUnitsService.deactivate', () => {
  it('sets is_active to false', async () => {
    const { service, prisma } = makeService();
    await service.deactivate('medvirtual');
    expect(prisma.businessUnit.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { is_active: false } }),
    );
  });

  it('throws NotFoundException for unknown slug', async () => {
    const { service } = makeService({
      businessUnit: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
    });
    await expect(service.deactivate('ghost')).rejects.toThrow(NotFoundException);
  });
});

// ── updateBranding ─────────────────────────────────────────────────────────────

describe('BusinessUnitsService.updateBranding', () => {
  const dto = { primary_color: '#FD7171', company_name: 'Berry Virtual' };

  it('snapshots current branding to history before overwriting', async () => {
    const { service, prisma } = makeService();
    await service.updateBranding('medvirtual', dto, 'user-1');
    expect(prisma.emailBrandingHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          branding_id: BRANDING.id,
          changed_by: 'user-1',
          snapshot: expect.objectContaining({ primary_color: BRANDING.primary_color }),
        }),
      }),
    );
  });

  it('applies only the fields present in dto (partial update)', async () => {
    const { service, prisma } = makeService();
    await service.updateBranding('medvirtual', { primary_color: '#FF0000' }, 'user-1');
    expect(prisma.emailBranding.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ primary_color: '#FF0000', updated_by: 'user-1' }),
      }),
    );
    // secondary_color should NOT be in the update payload
    const updateCall = (prisma.emailBranding.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty('secondary_color');
  });

  it('applies button_color and button_text_color and snapshots their previous values', async () => {
    const { service, prisma } = makeService();
    await service.updateBranding(
      'medvirtual',
      { button_color: '#112233', button_text_color: '#F0F0F0' },
      'user-1',
    );
    expect(prisma.emailBranding.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          button_color: '#112233',
          button_text_color: '#F0F0F0',
        }),
      }),
    );
    expect(prisma.emailBrandingHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          snapshot: expect.objectContaining({
            button_color: BRANDING.button_color,
            button_text_color: BRANDING.button_text_color,
          }),
        }),
      }),
    );
  });

  it('throws NotFoundException when BU does not exist', async () => {
    const { service } = makeService({
      businessUnit: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
    });
    await expect(service.updateBranding('ghost', dto, 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when branding record does not exist', async () => {
    const { service } = makeService({
      emailBranding: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
    });
    await expect(service.updateBranding('medvirtual', dto, 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});

// ── sync bidirecional ──────────────────────────────────────────────────────────

describe('BusinessUnitsService — sync bidirecional', () => {
  const updatedBranding = { ...BRANDING, primary_color: '#FF0000' };

  afterEach(() => {
    delete process.env.PEER_ENV_API_URL;
    delete process.env.INTER_ENV_SYNC_SECRET;
  });

  it('calls syncBrandingToPeer after updateBranding when env vars are set', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;
    process.env.PEER_ENV_API_URL = 'https://peer.example.com';
    process.env.INTER_ENV_SYNC_SECRET = 'secret123';

    const prisma = makePrisma({
      emailBranding: {
        findUnique: jest.fn().mockResolvedValue(BRANDING),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue(updatedBranding),
      },
    });
    const service = new (BusinessUnitsService as any)(prisma) as BusinessUnitsService;

    await service.updateBranding('medvirtual', { primary_color: '#FF0000' }, 'user-1');
    await new Promise((r) => setTimeout(r, 10));

    expect(mockFetch).toHaveBeenCalledWith(
      'https://peer.example.com/business-units/medvirtual/branding/sync',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-Sync-Secret': 'secret123' }),
      }),
    );
  });

  it('does NOT call fetch when PEER_ENV_API_URL is not set', async () => {
    const mockFetch = jest.fn();
    global.fetch = mockFetch;
    delete process.env.PEER_ENV_API_URL;

    const { service } = makeService();
    await service.updateBranding('medvirtual', { primary_color: '#FF0000' }, 'user-1');
    await new Promise((r) => setTimeout(r, 10));

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('BusinessUnitsService.receiveBrandingSyncFromPeer', () => {
  const payload = { primary_color: '#FD7171', company_name: 'Berry Virtual' };

  it('snapshots the current branding with changed_by = "sync"', async () => {
    const { service, prisma } = makeService();
    await service.receiveBrandingSyncFromPeer('medvirtual', payload, 'PROD');
    expect(prisma.emailBrandingHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ changed_by: 'sync' }),
      }),
    );
  });

  it('applies the payload fields to the branding record', async () => {
    const { service, prisma } = makeService();
    await service.receiveBrandingSyncFromPeer('medvirtual', payload, 'PROD');
    expect(prisma.emailBranding.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          primary_color: '#FD7171',
          company_name: 'Berry Virtual',
          updated_by: 'sync',
        }),
      }),
    );
  });

  it('does NOT call syncBrandingToPeer after receiving (anti-loop guarantee)', async () => {
    const mockFetch = jest.fn();
    global.fetch = mockFetch;
    process.env.PEER_ENV_API_URL = 'https://peer.example.com';
    process.env.INTER_ENV_SYNC_SECRET = 'secret123';

    const { service } = makeService();
    await service.receiveBrandingSyncFromPeer('medvirtual', payload, 'PROD');
    await new Promise((r) => setTimeout(r, 10));

    expect(mockFetch).not.toHaveBeenCalled();

    delete process.env.PEER_ENV_API_URL;
    delete process.env.INTER_ENV_SYNC_SECRET;
  });

  it('ignores sync for an unknown BU slug without throwing', async () => {
    const { service } = makeService({
      emailBranding: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
    });
    await expect(
      service.receiveBrandingSyncFromPeer('ghost', payload, 'PROD'),
    ).resolves.not.toThrow();
  });
});

// ── getBrandingHistory ─────────────────────────────────────────────────────────

describe('BusinessUnitsService.getBrandingHistory', () => {
  it('returns branding history ordered by most recent first', async () => {
    const { service } = makeService();
    const result = await service.getBrandingHistory('medvirtual');
    expect(result.status).toBe(200);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('throws NotFoundException for unknown slug', async () => {
    const { service } = makeService({
      businessUnit: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
    });
    await expect(service.getBrandingHistory('ghost')).rejects.toThrow(NotFoundException);
  });
});
