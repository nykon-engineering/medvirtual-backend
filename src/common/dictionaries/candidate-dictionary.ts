export const candidadeToDbDictionary : Record<string, string> = {

    hs_object_id: 'hubspot_id',
    email: 'email',
    first_name: 'first_name',
    last_name: 'last_name',
    name: 'name',
    hs_pipeline_stage: 'pipeline_status',
    agreed_hourly_pay_rate: 'hourly_pay_rate',
    resume_link: 'resume_url',
    practice_area_experience: 'specialization',
    country__residence_: 'country',
    employment_type: 'employment_type',
    tools: 'tools',
    medical_tools: 'medical_tools',
    gender: 'gender',
    va_role_s: 'approved_positions_pairing'

}

export const dbToCandidateDictionary : Record<string, string> = Object.fromEntries(
    Object.entries(candidadeToDbDictionary).map(([key, value]) => [value, key])
);