import { PrismaService } from '../../../prisma/prisma.service';
import {
  EmailTheme,
  getEmailThemeByBusinessUnit,
  getEmailThemeByUserId,
} from './theme';

// Maps the Organization.business_unit display value to the EmailBranding slug.
// Organization stores "Berry Virtual" / "MedVirtual"; EmailBranding uses "berry-virtual" / "medvirtual".
export function orgBusinessUnitToSlug(
  orgBusinessUnit: string | null,
): string | null {
  if (!orgBusinessUnit) return null;
  return orgBusinessUnit.toLowerCase().replace(/\s+/g, '-');
}

// Resolves EmailBranding from the DB for a given slug.
// Returns null when prisma is unavailable (e.g. tests) or the row doesn't exist.
async function getBrandingFromDb(
  prisma: PrismaService,
  slug: string | null,
): Promise<EmailTheme | null> {
  if (!slug || !prisma?.emailBranding) return null;

  try {
    const branding = await prisma.emailBranding.findUnique({
      where: { business_unit: slug },
    });
    if (!branding) return null;

    return {
      primaryColor: branding.primary_color,
      primaryColorHover: branding.secondary_color ?? '#013A4F',
      secondaryColor: '#F8F9FA',
      accentColor: branding.primary_color,
      companyName: branding.company_name,
      logoUrl: branding.logo_url ?? undefined,
      buttonColor: branding.button_color ?? undefined,
      buttonTextColor: branding.button_text_color ?? undefined,
      layoutPreset: branding.layout_preset,
    };
  } catch {
    return null;
  }
}

// Resolves the email theme for an organization's business_unit display value
// (e.g. "MedVirtual" / "Berry Virtual"). Reads the saved custom design from the
// DB, falling back to the hardcoded theme when no branding row exists.
// Used by broadcast emails that target all org users (no single userId).
export async function getBusinessUnitEmailTheme(
  prisma: PrismaService,
  orgBusinessUnit: string | null,
): Promise<EmailTheme> {
  const slug = orgBusinessUnitToSlug(orgBusinessUnit);
  const dbTheme = await getBrandingFromDb(prisma, slug);
  return dbTheme ?? getEmailThemeByBusinessUnit(orgBusinessUnit);
}

export async function isUserBerryVirtual(
  prisma: PrismaService,
  userId: string,
): Promise<boolean> {
  try {
    if (!prisma || !prisma.uSER || !prisma.organization) return false;

    const user = await prisma.uSER.findUnique({
      where: { id: userId },
      select: { id: true, organization_id: true, role: true },
    });

    if (!user) return false;
    if (['system_super_admin', 'system_admin'].includes(user.role))
      return false;
    if (!user.organization_id) return false;

    const organizations = await prisma.organization.findMany({
      where: {
        OR: [
          { admin_id: userId },
          { owner_id: userId },
          { id: user.organization_id },
        ],
      },
      select: { business_unit: true, status: true },
    });

    return organizations.some(
      (org) => org.business_unit === 'Berry Virtual' && org.status === 'active',
    );
  } catch (error) {
    if (
      !error.message?.includes('Environment variable not found') &&
      !error.message?.includes('Cannot read properties of undefined')
    ) {
      console.error('Error checking if user is Berry Virtual:', error);
    }
    return false;
  }
}

export async function getUserEmailTheme(
  prisma: PrismaService,
  userId: string,
): Promise<EmailTheme | null> {
  try {
    if (!prisma || !prisma.uSER || !prisma.organization) {
      return getEmailThemeByUserId(userId, []);
    }

    const user = await prisma.uSER.findUnique({
      where: { id: userId },
      select: { id: true, organization_id: true, role: true },
    });

    if (!user) return null;

    // System admins always use MedVirtual — resolve from DB first, hardcoded fallback
    if (['system_super_admin', 'system_admin'].includes(user.role)) {
      const dbTheme = await getBrandingFromDb(prisma, 'medvirtual');
      return dbTheme ?? getEmailThemeByBusinessUnit('MedVirtual');
    }

    if (!user.organization_id) {
      const dbTheme = await getBrandingFromDb(prisma, 'medvirtual');
      return dbTheme ?? getEmailThemeByBusinessUnit('MedVirtual');
    }

    const organizations = await prisma.organization.findMany({
      where: {
        OR: [
          { admin_id: userId },
          { owner_id: userId },
          { id: user.organization_id },
        ],
      },
      select: { business_unit: true, status: true },
    });

    // Resolve the active business_unit using existing priority logic
    const berryOrg = organizations.find(
      (o) => o.business_unit === 'Berry Virtual' && o.status === 'active',
    );
    const activeOrgBu =
      berryOrg?.business_unit ??
      organizations.find((o) => o.status === 'active')?.business_unit ??
      null;

    const slug = orgBusinessUnitToSlug(activeOrgBu);

    // Try DB branding first; fall back to hardcoded theme
    const dbTheme = await getBrandingFromDb(prisma, slug);
    return dbTheme ?? getEmailThemeByUserId(userId, organizations);
  } catch (error) {
    if (
      !error.message?.includes('Environment variable not found') &&
      !error.message?.includes('Cannot read properties of undefined')
    ) {
      console.error('Error getting user email theme:', error);
    }
    return getEmailThemeByUserId(userId, []);
  }
}
