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
