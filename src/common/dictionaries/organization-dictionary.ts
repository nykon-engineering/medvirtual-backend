export const organizationToDbDictionary : Record<string, string> = {
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
    founded_year: 'date_founded',
    industry: 'industry',
    numberofemployees: 'number_of_employees',
    owneremail: 'owner_email',
    ownername: 'owner_first_name',
    phone: 'phone',
    referral_email: 'email',
    specialty: 'specialties',
    type:'organization_role',
    business_unit: 'business_unit',
};

export const dbToOrganizationDictionary : Record<string, string> = Object.fromEntries(  
    Object.entries(organizationToDbDictionary).map(([key, value]) => [value, key])
);