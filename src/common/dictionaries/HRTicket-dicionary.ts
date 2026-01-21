export const hrTicketToDbDictionary : Record<string, string | string> = {

    subject: 'title',
    content: 'description',
    hs_pipeline: 'hubspot_pipeline',
    hs_pipeline_stage: 'hubspot_pipeline_stage',
    pairing_request_type: 'hubspot_pairing_request_type',
    ticket_type: 'hubspot_ticket_type',
    business_unit: 'hubspot_business_unit',
    company_name: 'hubspot_company_name',
    company_url: 'hubspot_company_url',
    va_deployment_type: 'availability',
    va_type: 'hubspot_role_type',
    contract_amount: 'hubspot_contract_amount',
    language: 'hubspot_language',
    number_of_vas: 'hubspot_numberVA',

    tasks: 'hubspot_tasks',
    n2_monitors_required_: 'hubspot_n2_monitors_required',
    va_shift_hours: 'hubspot_va_shift_hours',
    special_sourcing_needed: 'hubspot_special_sourcing_needed',
    special_requirements: 'hubspot_special_requirements',
    additional_training_requested: 'hubspot_additional_training_requested',
    pairing_date: 'hubspot_pairing_date',
    pairing_time: 'hubspot_pairing_time',
    //hire_date__start_of_employment_: 'expected_start_date', => issue form hubspot saying 'Enter a date before ${currentDate}': 
}

export const dbToHrTicketDictionary : Record<string, string> = Object.fromEntries(
    Object.entries(hrTicketToDbDictionary).map(([key, value]) => [value, key])
);


export const HRTicketStatus : Record<string, string> = {
    "1": 'New Agent Request',
    "1186989187": 'Upcoming Pairing Interview',
    "170668147": 'Sourcing Candidates',
    "77766410": 'Candidates Endorsed',
    "29355412": 'Candidates Interview Booked',
    "29357364": 'Interview Done (For Follow-up)',
    "950070186": 'For Onboarding (Paired)',
    "4": 'Endorsed to Ops-Day 1',
    "19668634": 'Pairing Lost'   
}

