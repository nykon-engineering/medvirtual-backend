// Role arrays used across all Med Alliance guards.
// Keep in sync with 01-roles-and-permissions.md.

export const AFFILIATE_ROLES = [
  'organization_admin',
  'organization_super_admin',
] as const;

export const ADMIN_ROLES = [
  'system_admin',
  'system_super_admin',
  'finance_admin',
] as const;

export const MA_ALL_ROLES = [...AFFILIATE_ROLES, ...ADMIN_ROLES] as const;
