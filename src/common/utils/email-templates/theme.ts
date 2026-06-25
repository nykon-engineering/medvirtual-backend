export interface EmailTheme {
  primaryColor: string;
  primaryColorHover: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl?: string;
  companyName: string;
}

export function getEmailThemeByBusinessUnit(
  businessUnit: string | null,
): EmailTheme {
  switch (businessUnit) {
    case 'Berry Virtual':
      return {
        primaryColor: '#FD7171',
        primaryColorHover: '#E55A5A',
        secondaryColor: '#F8F9FA',
        accentColor: '#FD7171',
        companyName: 'Berry Virtual',
        logoUrl: 'https://staging.medvirtual.ai/logobv.png',
      };
    case 'MedVirtual':
    default:
      return {
        primaryColor: '#01546B',
        primaryColorHover: '#013A4F',
        secondaryColor: '#F8F9FA',
        accentColor: '#00B2E2',
        companyName: 'MedVirtual',
        logoUrl: 'https://staging.medvirtual.ai/logo.png',
      };
  }
}

export function getEmailThemeByUserId(
  userId: string,
  organizations: any[],
): EmailTheme {
  // Find Berry Virtual first, then fallback to any other business_unit
  const berryVirtualOrg = organizations.find(
    (org) => org.business_unit === 'Berry Virtual' && org.status === 'active',
  );

  const businessUnit =
    berryVirtualOrg?.business_unit ??
    organizations.find((org) => org.status === 'active')?.business_unit ??
    null;

  return getEmailThemeByBusinessUnit(businessUnit);
}
