// Dictionary to convert approved_positions_pairing value to display label
// Usage: pass the value (from DB/HubSpot) and get the label back
export const approvedPositionsPairingDictionary: Record<string, string> = {
    '(Special Sourcing Needed)': '(Special Sourcing Needed)',
    'Accountant': 'Accountant',
    'Administrative Assistant (Admin)': 'Administrative Assistant (Admin)',
    'Jr Bookkeeper': 'Bookkeeper Jr',
    'Sr Bookkeeper': 'Bookkeeper Sr',
    'Client Success Manager': 'Client Success Manager',
    'Customer Service': 'Customer Service',
    'Jr Dental Admin': 'Dental Admin Jr',
    'Sr Dental Admin': 'Dental Admin Sr',
    'Jr Dental Biller': 'Dental Biller Jr',
    'Sr Dental Biller': 'Dental Biller Sr',
    'Dental Doctor (Dentist)': 'Dental Doctor (Dentist)',
    'Digital Marketing Specialist': 'Digital Marketing Specialist',
    'Executive Assistant': 'Executive Assistant',
    'Full Cycle Dental Biller': 'Full Cycle Dental Biller',
    'Full-cycle Medical Biller': 'Full Cycle Medical Biller',
    'General Admin': 'General Admin',
    'Internal': 'Internal',
    'Lead Generation Specialist': 'Lead Generation Specialist',
    'Marketing Assistant': 'Marketing Assistant',
    'Med-Legal Case Coordinator': 'Med-Legal Case Coordinator',
    'Jr Medical Admin': 'Medical Admin Jr',
    'Sr Medical Admin': 'Medical Admin Sr',
    'Jr Medical Biller': 'Medical Biller Jr',
    'Sr Medical Biller': 'Medical Biller Sr',
    'Jr Medical Case Coordinator': 'Medical Case Coordinator Jr',
    'Sr Medical Case Coordinator': 'Medical Case Coordinator Sr',
    'Medical Doctor': 'Medical Doctor (MD)',
    'Medical Scribe': 'Medical Scribe',
    'Medical Transcriptionist': 'Medical Transcriptionist',
    'Mid-Level Bookkeeper': 'Mid-Level Bookkeeper',
    'Nurse': 'Nurse',
    'Nurse (USRN)': 'Nurse (USRN)',
    'Project Manager': 'Project Manager',
    'Sales and Account Manager': 'Sales and Account Manager',
    'Sales Development Representative': 'Sales Development Representative',
    'Sales Executive': 'Sales Executive',
    'Social Media Manager': 'Social Media Manager',
    'Transaction Coordinator': 'Transaction Coordinator',
};

// Reverse dictionary: label → value
export const approvedPositionsPairingReverseDictionary: Record<string, string> = Object.fromEntries(
    Object.entries(approvedPositionsPairingDictionary).map(([key, value]) => [value, key])
);

// Helper function to get label from value
export function getApprovedPositionLabel(value: string): string {
    return approvedPositionsPairingDictionary[value] ?? value;
}
