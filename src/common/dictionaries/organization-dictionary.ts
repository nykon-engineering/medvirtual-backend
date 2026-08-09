export const organizationToDbDictionary: Record<string, string> = {
  hs_object_id: 'hubspot_id',
  name: 'name',
  about_us: 'description',
  address: 'address',
  city: 'city',
  state: 'state',
  zip: 'postal_code',
  country: 'location',
  domain: 'website_url',
  description: 'description',
  industry: 'industry',
  numberofemployees: 'number_of_employees',
  phone: 'phone',
  referral_email: 'email',
  specialty: 'specialties',
  type: 'type',
  business_unit: 'business_unit',
  hubspot_owner_id: 'hubspot_owner_id',
  deploy_date_of_first_va: 'deployment_date',
};

export const dbToOrganizationDictionary: Record<string, string> =
  Object.fromEntries(
    Object.entries(organizationToDbDictionary).map(([key, value]) => [
      value,
      key,
    ]),
  );
