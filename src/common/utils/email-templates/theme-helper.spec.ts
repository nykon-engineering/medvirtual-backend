import { getUserEmailTheme } from './theme-helper';

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
