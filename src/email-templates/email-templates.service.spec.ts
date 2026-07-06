import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EmailTemplatesService } from './email-templates.service';

// ── Shared fixtures ────────────────────────────────────────────────────────────

const TEMPLATE = {
  id: 'tpl-1',
  key: 'invite-signup',
  name: 'User Invitation',
  description: null,
  subject: 'You have been invited to {{companyName}}',
  headline: 'Welcome!',
  body: 'Hi, click here: {{inviteLink}}',
  button_label: 'Activate',
  button_url: '{{inviteLink}}',
  placeholders: ['{{inviteLink}}', '{{companyName}}'],
  business_unit: null,
  is_active: true,
  updated_by: null,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
};

const HISTORY_ENTRY = {
  id: 'hist-1',
  template_id: 'tpl-1',
  subject: 'Old subject',
  headline: 'Old headline',
  body: 'Old body',
  button_label: 'Old button',
  changed_by: 'user-42',
  changed_at: new Date('2026-01-01T10:00:00Z'),
  reason: 'Manual edit',
};

const BRANDING = {
  id: 'brand-1',
  business_unit: 'medvirtual',
  primary_color: '#01546B',
  secondary_color: '#013A4F',
  logo_url: 'https://staging.medvirtual.ai/logo.png',
  company_name: 'MedVirtual',
  layout_preset: 'default',
  updated_by: null,
  updated_at: new Date('2026-01-01'),
};

// ── Mock factories ─────────────────────────────────────────────────────────────

const makePrisma = (overrides: Record<string, unknown> = {}) => ({
  $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  emailTemplate: {
    findFirst: jest.fn().mockResolvedValue(TEMPLATE),
    findMany: jest.fn().mockResolvedValue([TEMPLATE]),
    count: jest.fn().mockResolvedValue(1),
    update: jest.fn().mockResolvedValue({ ...TEMPLATE, subject: 'Updated subject' }),
  },
  emailTemplateHistory: {
    create: jest.fn().mockResolvedValue(HISTORY_ENTRY),
    findMany: jest.fn().mockResolvedValue([HISTORY_ENTRY]),
    findUnique: jest.fn().mockResolvedValue(HISTORY_ENTRY),
  },
  emailBranding: {
    findUnique: jest.fn().mockResolvedValue(BRANDING),
  },
  ...overrides,
});

const makeMail = () => ({
  sendMail: jest.fn().mockResolvedValue(true),
});

async function buildService(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = makePrisma(prismaOverrides);
  const mail = makeMail();

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      EmailTemplatesService,
      { provide: 'PrismaService', useValue: prisma },
      { provide: 'MailService', useValue: mail },
    ],
  })
    .overrideProvider(EmailTemplatesService)
    .useFactory({
      factory: () => {
        const svc = new (EmailTemplatesService as any)(prisma, mail);
        return svc;
      },
    })
    .compile();

  return {
    service: module.get<EmailTemplatesService>(EmailTemplatesService),
    prisma,
    mail,
  };
}

// ── validatePlaceholders ───────────────────────────────────────────────────────

describe('EmailTemplatesService.validatePlaceholders', () => {
  let service: EmailTemplatesService;

  beforeAll(async () => {
    ({ service } = await buildService());
  });

  it('passes when body has no placeholders', () => {
    expect(() => service.validatePlaceholders('Hello world', ['{{inviteLink}}'])).not.toThrow();
  });

  it('passes when all used placeholders are in the allowed list', () => {
    expect(() =>
      service.validatePlaceholders('Click {{inviteLink}} and {{companyName}}', [
        '{{inviteLink}}',
        '{{companyName}}',
      ]),
    ).not.toThrow();
  });

  it('throws BadRequestException for a single undeclared placeholder', () => {
    expect(() =>
      service.validatePlaceholders('Hello {{userName}}', ['{{inviteLink}}']),
    ).toThrow(BadRequestException);
  });

  it('throws BadRequestException and lists all invalid placeholders', () => {
    try {
      service.validatePlaceholders('{{badOne}} and {{badTwo}}', ['{{inviteLink}}']);
      fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).message).toContain('{{badOne}}');
      expect((e as BadRequestException).message).toContain('{{badTwo}}');
    }
  });
});

// ── applyPlaceholders ──────────────────────────────────────────────────────────

describe('EmailTemplatesService.applyPlaceholders', () => {
  let service: EmailTemplatesService;

  beforeAll(async () => {
    ({ service } = await buildService());
  });

  it('replaces a known placeholder with sample data', () => {
    const result = service.applyPlaceholders('Hello {{userName}}');
    expect(result).toBe('Hello Jane Smith');
  });

  it('replaces multiple placeholders in a single call', () => {
    const result = service.applyPlaceholders('{{companyName}} — {{userName}}');
    expect(result).toBe('MedVirtual — Jane Smith');
  });

  it('leaves unknown placeholders unchanged', () => {
    const result = service.applyPlaceholders('Hello {{unknownField}}');
    expect(result).toBe('Hello {{unknownField}}');
  });

  it('allows caller overrides to take precedence over sample data', () => {
    const result = service.applyPlaceholders('Hi {{userName}}', { '{{userName}}': 'Dr. House' });
    expect(result).toBe('Hi Dr. House');
  });
});

// ── findOne ────────────────────────────────────────────────────────────────────

describe('EmailTemplatesService.findOne', () => {
  it('returns the template when found', async () => {
    const { service } = await buildService();
    const result = await service.findOne('invite-signup');
    expect(result.status).toBe(200);
    expect(result.data.key).toBe('invite-signup');
  });

  it('throws NotFoundException when template does not exist', async () => {
    const { service } = await buildService({
      emailTemplate: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
  });
});

// ── update ─────────────────────────────────────────────────────────────────────

describe('EmailTemplatesService.update', () => {
  const dto = {
    subject: 'New subject',
    body: 'New body with {{inviteLink}}',
    reason: 'Test update',
  };

  it('saves a history snapshot before updating', async () => {
    const { service, prisma } = await buildService();
    await service.update('invite-signup', dto, 'user-1');
    expect(prisma.emailTemplateHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subject: TEMPLATE.subject,
          body: TEMPLATE.body,
          changed_by: 'user-1',
        }),
      }),
    );
  });

  it('persists the new wording to the template', async () => {
    const { service, prisma } = await buildService();
    await service.update('invite-signup', dto, 'user-1');
    expect(prisma.emailTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subject: dto.subject,
          body: dto.body,
          updated_by: 'user-1',
        }),
      }),
    );
  });

  it('throws BadRequestException when body contains an undeclared placeholder', async () => {
    const { service } = await buildService();
    await expect(
      service.update(
        'invite-signup',
        { subject: 'S', body: 'Hi {{unknownField}}' },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when template does not exist', async () => {
    const { service } = await buildService({
      emailTemplate: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    });
    await expect(service.update('ghost', dto, 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('does NOT call syncToPeer when PEER_ENV_API_URL is not set', async () => {
    const originalFetch = global.fetch;
    const mockFetch = jest.fn();
    global.fetch = mockFetch;
    delete process.env.PEER_ENV_API_URL;
    delete process.env.INTER_ENV_SYNC_SECRET;

    const { service } = await buildService();
    await service.update('invite-signup', dto, 'user-1');

    // Allow the fire-and-forget to settle
    await new Promise((r) => setTimeout(r, 10));
    expect(mockFetch).not.toHaveBeenCalled();
    global.fetch = originalFetch;
  });

  it('calls syncToPeer when both PEER_ENV_API_URL and INTER_ENV_SYNC_SECRET are set', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;
    process.env.PEER_ENV_API_URL = 'https://peer.example.com';
    process.env.INTER_ENV_SYNC_SECRET = 'secret123';

    const { service } = await buildService();
    await service.update('invite-signup', dto, 'user-1');

    await new Promise((r) => setTimeout(r, 10));
    expect(mockFetch).toHaveBeenCalledWith(
      'https://peer.example.com/email-templates/invite-signup/sync',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Sync-Secret': 'secret123',
        }),
      }),
    );

    delete process.env.PEER_ENV_API_URL;
    delete process.env.INTER_ENV_SYNC_SECRET;
  });
});

// ── rollback ───────────────────────────────────────────────────────────────────

describe('EmailTemplatesService.rollback', () => {
  it('restores the snapshot values to the template', async () => {
    const { service, prisma } = await buildService();
    await service.rollback('invite-signup', 'hist-1', 'user-1');
    expect(prisma.emailTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subject: HISTORY_ENTRY.subject,
          body: HISTORY_ENTRY.body,
        }),
      }),
    );
  });

  it('saves the current state to history before rolling back', async () => {
    const { service, prisma } = await buildService();
    await service.rollback('invite-signup', 'hist-1', 'user-1');
    expect(prisma.emailTemplateHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subject: TEMPLATE.subject,
          body: TEMPLATE.body,
          changed_by: 'user-1',
          reason: expect.stringContaining('Rollback'),
        }),
      }),
    );
  });

  it('throws NotFoundException when history entry does not exist', async () => {
    const { service } = await buildService({
      emailTemplateHistory: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
    });
    await expect(service.rollback('invite-signup', 'bad-id', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException when history entry belongs to a different template', async () => {
    const { service } = await buildService({
      emailTemplateHistory: {
        findUnique: jest.fn().mockResolvedValue({ ...HISTORY_ENTRY, template_id: 'tpl-OTHER' }),
        create: jest.fn(),
      },
    });
    await expect(service.rollback('invite-signup', 'hist-1', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});

// ── receiveSyncFromPeer (anti-loop) ────────────────────────────────────────────

describe('EmailTemplatesService.receiveSyncFromPeer', () => {
  const payload = { subject: 'Synced subject', body: 'Synced body' };

  it('saves a history snapshot with changed_by = "sync"', async () => {
    const { service, prisma } = await buildService();
    await service.receiveSyncFromPeer('invite-signup', payload, 'PROD');
    expect(prisma.emailTemplateHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          changed_by: 'sync',
          reason: 'Auto-sync from PROD',
        }),
      }),
    );
  });

  it('updates the template with the synced payload', async () => {
    const { service, prisma } = await buildService();
    await service.receiveSyncFromPeer('invite-signup', payload, 'PROD');
    expect(prisma.emailTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subject: payload.subject,
          body: payload.body,
          updated_by: 'sync',
        }),
      }),
    );
  });

  it('does NOT call syncToPeer after receiving a sync (anti-loop guarantee)', async () => {
    const mockFetch = jest.fn();
    global.fetch = mockFetch;
    process.env.PEER_ENV_API_URL = 'https://peer.example.com';
    process.env.INTER_ENV_SYNC_SECRET = 'secret123';

    const { service } = await buildService();
    await service.receiveSyncFromPeer('invite-signup', payload, 'PROD');

    await new Promise((r) => setTimeout(r, 10));
    expect(mockFetch).not.toHaveBeenCalled();

    delete process.env.PEER_ENV_API_URL;
    delete process.env.INTER_ENV_SYNC_SECRET;
  });

  it('ignores sync for an unknown template key without throwing', async () => {
    const { service } = await buildService({
      emailTemplate: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    });
    await expect(
      service.receiveSyncFromPeer('nonexistent', payload, 'PROD'),
    ).resolves.not.toThrow();
  });
});

// ── testSend ───────────────────────────────────────────────────────────────────

describe('EmailTemplatesService.testSend', () => {
  it('sends an email to the user email with [TEST] prefix in subject', async () => {
    const { service, mail } = await buildService();
    await service.testSend('invite-signup', {}, 'user-1', 'admin@example.com');
    expect(mail.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@example.com',
        subject: expect.stringContaining('[TEST]'),
      }),
    );
  });

  it('throws NotFoundException for an unknown template', async () => {
    const { service } = await buildService({
      emailTemplate: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    await expect(
      service.testSend('ghost', {}, 'user-1', 'admin@example.com'),
    ).rejects.toThrow(NotFoundException);
  });

  it('honors business_unit from dto for the template row, not just branding', async () => {
    const buRow = { ...TEMPLATE, business_unit: 'berry-virtual', headline: 'Berry Welcome!' };
    const findFirst = jest.fn().mockResolvedValueOnce(buRow);
    const { service, prisma, mail } = await buildService({
      emailTemplate: { findFirst },
    });
    await service.testSend(
      'invite-signup',
      { business_unit: 'berry-virtual' },
      'user-1',
      'admin@example.com',
    );
    expect(prisma.emailTemplate.findFirst).toHaveBeenCalledWith({
      where: { key: 'invite-signup', business_unit: 'berry-virtual' },
    });
    expect(mail.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ html: expect.stringContaining('Berry Welcome!') }),
    );
  });

  it('falls back to the default row when the BU has no dedicated template', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(TEMPLATE);
    const { service, mail } = await buildService({
      emailTemplate: { findFirst },
    });
    await service.testSend(
      'invite-signup',
      { business_unit: 'berry-virtual' },
      'user-1',
      'admin@example.com',
    );
    expect(findFirst).toHaveBeenCalledTimes(2);
    expect(findFirst).toHaveBeenNthCalledWith(1, {
      where: { key: 'invite-signup', business_unit: 'berry-virtual' },
    });
    expect(findFirst).toHaveBeenNthCalledWith(2, {
      where: { key: 'invite-signup', business_unit: null },
    });
    expect(mail.sendMail).toHaveBeenCalled();
  });
});

// ── preview ────────────────────────────────────────────────────────────────────

describe('EmailTemplatesService.preview', () => {
  it('returns rendered HTML and subject with placeholders filled', async () => {
    const { service } = await buildService();
    const result = await service.preview('invite-signup', {});
    expect(result.status).toBe(200);
    expect(result.data.html).toContain('<!DOCTYPE html>');
    expect(result.data.subject).not.toContain('{{');
  });

  it('uses override body from dto when provided', async () => {
    const { service } = await buildService();
    const result = await service.preview('invite-signup', {
      body: 'Custom body content',
    });
    expect(result.data.html).toContain('Custom body content');
  });

  it('resolves branding from DB when business_unit is provided in dto', async () => {
    const { service, prisma } = await buildService();
    await service.preview('invite-signup', { business_unit: 'medvirtual' });
    expect(prisma.emailBranding.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { business_unit: 'medvirtual' } }),
    );
  });

  it('falls back to MedVirtual branding when no BU is provided', async () => {
    const { service, prisma } = await buildService({
      emailBranding: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const result = await service.preview('invite-signup', {});
    expect(result.data.html).toContain('#01546B');
  });

  it('honors business_unit from dto for the template row, not just branding', async () => {
    const buRow = { ...TEMPLATE, business_unit: 'berry-virtual', headline: 'Berry Welcome!' };
    const findFirst = jest.fn().mockResolvedValueOnce(buRow);
    const { service, prisma } = await buildService({
      emailTemplate: { findFirst },
    });
    const result = await service.preview('invite-signup', {
      business_unit: 'berry-virtual',
    });
    expect(prisma.emailTemplate.findFirst).toHaveBeenCalledWith({
      where: { key: 'invite-signup', business_unit: 'berry-virtual' },
    });
    expect(result.data.html).toContain('Berry Welcome!');
  });

  it('falls back to the default row when the BU has no dedicated template', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(TEMPLATE);
    const { service } = await buildService({
      emailTemplate: { findFirst },
    });
    const result = await service.preview('invite-signup', {
      business_unit: 'berry-virtual',
    });
    expect(findFirst).toHaveBeenCalledTimes(2);
    expect(findFirst).toHaveBeenNthCalledWith(1, {
      where: { key: 'invite-signup', business_unit: 'berry-virtual' },
    });
    expect(findFirst).toHaveBeenNthCalledWith(2, {
      where: { key: 'invite-signup', business_unit: null },
    });
    expect(result.data.html).toContain(TEMPLATE.headline);
  });

  it('throws NotFoundException when neither the BU row nor the default row exists', async () => {
    const { service } = await buildService({
      emailTemplate: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    await expect(
      service.preview('ghost', { business_unit: 'berry-virtual' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('falls back to primary_color background and #ffffff text when button colors are unset', async () => {
    const { service } = await buildService();
    const result = await service.preview('invite-signup', {
      business_unit: 'medvirtual',
    });
    expect(result.data.html).toContain(
      `background-color:${BRANDING.primary_color};color:#ffffff;`,
    );
  });

  it('uses button_color and button_text_color from branding when set', async () => {
    const { service } = await buildService({
      emailBranding: {
        findUnique: jest.fn().mockResolvedValue({
          ...BRANDING,
          button_color: '#112233',
          button_text_color: '#F0F0F0',
        }),
      },
    });
    const result = await service.preview('invite-signup', {
      business_unit: 'medvirtual',
    });
    expect(result.data.html).toContain(
      'background-color:#112233;color:#F0F0F0;',
    );
  });
});
