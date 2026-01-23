import { PhoneField } from "@hubspot/api-client/lib/codegen/marketing/forms";

export const contactToDbDictionary : Record<string, string | string[]> = {

    hs_object_id: 'hubspot_id',
    firstname: 'first_name',
    lastname: 'last_name',
    email: 'email',
    phone: 'phone',
    jobtitle: 'job_title',
    
}

export const dbToContactDictionary : Record<string, string> = Object.fromEntries(
    Object.entries(contactToDbDictionary).map(([key, value]) => [value, key])
);