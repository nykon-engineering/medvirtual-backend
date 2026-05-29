export const contactToDbDictionary: Record<string, string> = {
  hs_object_id: 'hubspot_id',
  firstname: 'first_name',
  lastname: 'last_name',
  email: 'email',
  phone: 'phone',
  jobtitle: 'job_title',
  company: 'company_name', //Company Name
  business_unit: 'business_unit', // Business Unit (Med Virtual, Berry Virtual)
  account_type: 'account_type', // Account type (Med Virtual, Berry Virtual)
  website: 'website_url',
  type: 'type', //type
  referral_source: 'referral_source', //Referral Source Type
  hubspot_owner_id: 'hubspot_owner_id', // Contact Owner
  billcom_vendor_id: 'hubspot_billcom_vendor_id', // Bill.com Vendor ID
};

export const dbToContactDictionary: Record<string, string> = Object.fromEntries(
  Object.entries(contactToDbDictionary).map(([key, value]) => [value, key]),
);
