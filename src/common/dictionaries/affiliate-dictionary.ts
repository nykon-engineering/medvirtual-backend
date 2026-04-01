export const affiliateToDbDictionary : Record<string, string> = {
    hs_object_id: 'hubspot_id',
    growth_partner_name: 'full_name',
    hs_pipeline: 'hubspot_pipeline',
    hs_pipeline_stage: 'hubspot_pipeline_stage',
    business_unit: 'business_unit',
}

export const dbToAffiliateDictionary : Record<string, string> = Object.fromEntries(
    Object.entries(affiliateToDbDictionary).map(([key, value]) => [value, key]));