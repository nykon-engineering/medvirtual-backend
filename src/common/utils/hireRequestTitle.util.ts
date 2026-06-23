export interface HireRequestTitleLike {
  hubspot_pairing_request_type?: string | null;
  hubspot_numberVA?: number | null;
  hubspot_role_type?: string | null;
  availability?: string | null;
  organization: { name: string };
}

export function buildHireRequestTitle(hr: HireRequestTitleLike): string {
  const isProduction = process.env.ENVIRONMENT === 'PROD';
  const basePrefix = isProduction ? 'HR' : 'TEST HR';
  const requestType = hr.hubspot_pairing_request_type || '';
  const firstPrefix =
    requestType === 'Upsell Agent'
      ? 'UPS '
      : requestType === 'Agent Replacement'
        ? 'REP '
        : '';

  const parts: string[] = [(firstPrefix + basePrefix).trim()];

  if (hr.organization?.name?.trim()) {
    parts.push(hr.organization.name);
  }

  if (hr.hubspot_numberVA) {
    parts.push(String(hr.hubspot_numberVA));
  }

  if (hr.hubspot_role_type?.trim()) {
    parts.push(hr.hubspot_role_type);
  }

  if (hr.availability?.trim()) {
    const formatted = hr.availability
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('-');
    if (formatted.trim()) {
      parts.push(formatted);
    }
  }

  return parts.filter((p) => p?.trim()).join(' - ');
}
