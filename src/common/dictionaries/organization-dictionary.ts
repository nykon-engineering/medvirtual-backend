export const organizationToDbDictionary : Record<string, string> = {
    hs_object_id: 'hubspot_id',
    name: 'name',
    about_us: 'description',
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
    //annualrevenue: '',
    //city: '',
    //closedate: '',
    //hs_country_code: '',
    //hs_csm_sentiment: '',
    //hs_linkedin_handle: '',
    //lifecyclestage: '',
    //address: '',
    //address2: '',
    //company_address: '',
    //hubspot_owner_id: '',
};

export const dbToOrganizationDictionary : Record<string, string> = Object.fromEntries(  
    Object.entries(organizationToDbDictionary).map(([key, value]) => [value, key])
);