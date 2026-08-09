export const ORGANIZATION_ROLES = [
  'organization_admin',
  'organization_super_admin',
] as const;

export const ADMIN_ROLES = ['system_admin', 'system_super_admin'] as const;

export const AFFILIATE_ROLES = ['affiliate'] as const;

export const MA_ALL_ROLES = [
  ...ORGANIZATION_ROLES,
  ...ADMIN_ROLES,
  ...AFFILIATE_ROLES,
] as const;
