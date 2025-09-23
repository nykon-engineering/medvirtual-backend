export const ownerToDbDictionary : Record<string, string> = {
    id: '',
    email: '',
    firstName: '',
    lastName: '',
}

export const dbToOwnerDictionary : Record<string, string> = Object.fromEntries( 
    Object.entries(ownerToDbDictionary).map(([key, value]) => [value, key])
);