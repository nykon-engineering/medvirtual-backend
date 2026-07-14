import {
  getUserEmailTheme,
  getBusinessUnitEmailTheme,
} from './theme-helper';

const BRANDING = {
  id: 'brand-1',
  business_unit: 'medvirtual',
  primary_color: '#01546B',
  secondary_color: '#013A4F',
  logo_url: 'https://staging.medvirtual.ai/logo.png',
  company_name: 'MedVirtual',
  button_color: null,
  button_text_color: null,
  layout_preset: 'hero',
  updated_by: null,
  updated_at: new Date('2026-01-01'),
};

const USER = {
  id: 'user-1',
  organization_id: 'org-1',
  role: 'organization_admin',
};

const ORGANIZATION = {
  business_unit: 'MedVirtual',
  status: 'active',
};

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    uSER: {
      findUnique: jest.fn().mockResolvedValue(USER),
    },
    organization: {
      findMany: jest.fn().mockResolvedValue([ORGANIZATION]),
    },
    emailBranding: {
      findUnique: jest.fn().mockResolvedValue(BRANDING),
    },
    ...overrides,
  } as any;
}

describe('theme-helper.getUserEmailTheme', () => {
  it('includes layoutPreset from the DB branding row in the resolved theme', async () => {
    const prisma = makePrisma();
    const theme = await getUserEmailTheme(prisma, 'user-1');
    expect(theme?.layoutPreset).toBe('hero');
  });

  it('falls back to the hardcoded theme (no layoutPreset drop) when no branding row exists', async () => {
    const prisma = makePrisma({
      emailBranding: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const theme = await getUserEmailTheme(prisma, 'user-1');
    expect(theme?.companyName).toBe('MedVirtual');
    expect(theme?.layoutPreset).toBe('default');
  });
});

describe('theme-helper.getBusinessUnitEmailTheme', () => {
  it('returns DB branding for the org business_unit, including button colors', async () => {
    const prisma = makePrisma({
      emailBranding: {
        findUnique: jest.fn().mockResolvedValue({
          ...BRANDING,
          button_color: '#123456',
          button_text_color: '#abcdef',
          layout_preset: 'minimal',
        }),
      },
    });

    const theme = await getBusinessUnitEmailTheme(prisma, 'MedVirtual');

    // Confirms the org display value was mapped to the "medvirtual" slug.
    expect(prisma.emailBranding.findUnique).toHaveBeenCalledWith({
      where: { business_unit: 'medvirtual' },
    });
    expect(theme.buttonColor).toBe('#123456');
    expect(theme.buttonTextColor).toBe('#abcdef');
    expect(theme.layoutPreset).toBe('minimal');
  });

  it('maps a multi-word business_unit to its slug (Berry Virtual → berry-virtual)', async () => {
    const prisma = makePrisma({
      emailBranding: { findUnique: jest.fn().mockResolvedValue(null) },
    });

    await getBusinessUnitEmailTheme(prisma, 'Berry Virtual');

    expect(prisma.emailBranding.findUnique).toHaveBeenCalledWith({
      where: { business_unit: 'berry-virtual' },
    });
  });

  it('falls back to the hardcoded theme when no branding row exists', async () => {
    const prisma = makePrisma({
      emailBranding: { findUnique: jest.fn().mockResolvedValue(null) },
    });

    const theme = await getBusinessUnitEmailTheme(prisma, 'Berry Virtual');

    expect(theme.companyName).toBe('Berry Virtual');
    expect(theme.primaryColor).toBe('#FD7171');
    expect(theme.layoutPreset).toBe('default');
  });
});
