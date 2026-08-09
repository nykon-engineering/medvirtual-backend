export const ownerToDbDictionary: Record<string, string> = {
  id: 'hubspot_id',
  email: 'email',
  firstName: 'first_name',
  lastName: 'last_name',
};

export const dbToOwnerDictionary: Record<string, string> = Object.fromEntries(
  Object.entries(ownerToDbDictionary).map(([key, value]) => [value, key]),
);
