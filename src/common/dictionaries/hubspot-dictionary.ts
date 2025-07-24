export const hubspotToDbDictionary : Record<string, string> = {

    hs_object_id: 'hubspot_id',
    email: 'email',
    name: 'first_name',
    nameFake: 'last_name',
    hs_pipeline_stage: 'status',
    agreed_hourly_pay_rate: 'pay_rate',
    resume_link: 'resume_url',
    //experience_years => we dont have on the hubspot
    //about_me => we dont have on the hubspot
    //processed_resume_data => I believe that this field is not necessary, we can use the created_at field in the database
    //processed_resume_data => I believe that this fiels id not necessary because the function will be async
    //processing_error => I don know where we'll use this field
    //processed_at => it means the moment when the candidate was import in MedVirtual or it means the last time that this candidade was modified?

    /*
    ... skills, experiences, educations, panelCandidates
    */

}

export const dbToHubspotDictionary : Record<string, string> = Object.fromEntries(
    Object.entries(hubspotToDbDictionary).map(([key, value]) => [value, key])
);