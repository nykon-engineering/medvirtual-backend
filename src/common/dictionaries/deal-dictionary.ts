export const dealToDbDictionary:Record<string,string> = {
    hs_object_id: 'hubspot_id', //The unique ID of the deal. This ID is set automatically by HubSpot when the deal is created.
    amount: 'salary',
    business_unit: '',
    client_name: 'hubspot_client_name',
    closedate: 'hubspot_close_date',  //Date the deal was closed. This property is set automatically by HubSpot.
    company_name: 'hubspot_company_name',
    contract_sign_date: 'hubspot_contract_sign_date',
    conversion_date: 'start_date',
    conversion_type: 'hubspot_conversion_type', //Full-time or Part-Time
    csm_deal_stage: 'hubspot_csm_deal_stage', //Sales Pipeline, For Demo, Demo Complete, Missed Demo, Contract Sent, Contract Signed, Lost, For Pairing, For Consultation, For Onboarding ...
    dealname: 'hubspot_deal_name',
    pipeline: 'hubspot_pipeline', //The pipeline the deal is in. This determines which stages are options for the deal.
    dealstage: 'hubspot_dealstage', //The stage of the deal. Deal stages allow you to categorize and track the progress of the deals that you are working on
    dealtype: 'hubspot_dealtype', //The type of deal. By default, categorize your deal as either a New Business or Existing Business. [New Business, Existing Business ]
    deployment_type: 'hubspot_deployment_type', //If agent is deployed in a full-time or part-time role
    description: 'hubspot_description',
    hs_acv: 'hubspot_hs_acv' //The annual contract value (ACV) of this deal

}

export const DbToDealDictionary : Record<string, string> = Object.fromEntries(  
    Object.entries(dealToDbDictionary).map(([key, value]) => [value, key])
);