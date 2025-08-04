export const candidadeToDbDictionary : Record<string, string> = {

    hs_object_id: 'hubspot_id',
    email: 'email',
    name: 'first_name',
    nameFake: 'last_name',
    hs_pipeline_stage: 'pipeline_status',
    agreed_hourly_pay_rate: 'hourly_pay_rate',
    resume_link: 'resume_url',
    practice_area_experience: 'specialization',
    country_residence: 'country',

}

export const dbToCandidateDictionary : Record<string, string> = Object.fromEntries(
    Object.entries(candidadeToDbDictionary).map(([key, value]) => [value, key])
);