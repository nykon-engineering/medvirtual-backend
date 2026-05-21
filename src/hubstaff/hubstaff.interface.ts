export interface HubstaffMember {
    id?: number;
    user_id: number;
    membership_role: string;
    membership_status: string;
    created_at: string;
    updated_at: string;
    last_client_activity: string;
    trackable: boolean;
    effective_role: string;
    view_only: boolean;
    profile?: HubstaffProfile;
    metadata?: Record<string, any>;
    user?: HubstaffUser;
}

export interface HubstaffUser {
    id: number;
    name: string;
    first_name: string;
    last_name: string;
    email: string;
    time_zone: string;
    ip_address: string;
    status: string;
    created_at: string;
    updated_at: string;
}

export interface HubstaffProfile {
    employee_id?: string;
    birthday?: string;
    started_on?: string;
    custom_fields?: Record<string, string>;
}