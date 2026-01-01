export const ticketTypeDictionary : Record<string, string> ={
    "Bonus": "bonus",
    "Termination": "termination",
    "Interview Request": "interview",
    "Support":  "support",
    "Referral":  "referral",
    "Hire Request Cancellation": "hire_request_cancellation",
}

// Reverse dictionary to convert backend type to frontend display name
export const ticketTypeReverseDictionary: Record<string, string> = Object.fromEntries(
    Object.entries(ticketTypeDictionary).map(([key, value]) => [value, key])
);