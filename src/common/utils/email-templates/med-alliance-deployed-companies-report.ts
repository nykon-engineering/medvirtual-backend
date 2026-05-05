import { getEmailHeader, getEmailFooter } from './components';

export interface PromotedCompanyEntry {
  orgId: string;
  orgName: string;
  eligibilityStartAt: string;
  commissionsPromoted: number;
}

export default function medAllianceDeployedCompaniesReport(
  promoted: PromotedCompanyEntry[],
  errors: string[],
  runAt: Date,
): string {
  const formattedDate = runAt.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  const totalCommissions = promoted.reduce((sum, p) => sum + p.commissionsPromoted, 0);
  const nothingToDo = promoted.length === 0 && errors.length === 0;

  const promotedRows = promoted
    .map(
      (p) => `
      <tr>
        <td style="border:1px solid #dee2e6;padding:10px 12px;font-size:14px;font-weight:600;">${p.orgName}</td>
        <td style="border:1px solid #dee2e6;padding:10px 12px;font-size:11px;color:#888;font-family:monospace;">${p.orgId}</td>
        <td style="border:1px solid #dee2e6;padding:10px 12px;font-size:14px;color:#555;text-align:center;">${p.eligibilityStartAt}</td>
        <td style="border:1px solid #dee2e6;padding:10px 12px;font-size:14px;text-align:center;font-weight:600;">${p.commissionsPromoted}</td>
      </tr>`,
    )
    .join('');

  const errorRows = errors
    .map(
      (e) => `
      <tr>
        <td style="border:1px solid #f5c6cb;padding:10px 12px;font-size:13px;color:#721c24;">${e}</td>
      </tr>`,
    )
    .join('');

  const promotedSection =
    promoted.length > 0
      ? `
      <h3 style="color:#181D27;margin-top:32px;margin-bottom:12px;">Promoted Companies (${promoted.length})</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:30px;">
        <thead>
          <tr style="background-color:#f4f4f4;">
            <th style="border:1px solid #dee2e6;padding:10px 12px;text-align:left;font-size:13px;">Company</th>
            <th style="border:1px solid #dee2e6;padding:10px 12px;text-align:left;font-size:13px;">Org ID</th>
            <th style="border:1px solid #dee2e6;padding:10px 12px;text-align:center;font-size:13px;">Deployed At</th>
            <th style="border:1px solid #dee2e6;padding:10px 12px;text-align:center;font-size:13px;">Commissions Promoted</th>
          </tr>
        </thead>
        <tbody>${promotedRows}</tbody>
      </table>`
      : '';

  const errorsSection =
    errors.length > 0
      ? `
      <h3 style="color:#721c24;margin-top:32px;margin-bottom:12px;">Errors (${errors.length})</h3>
      <p style="color:#721c24;font-size:14px;margin-bottom:16px;">The following companies could not be promoted. Please review them manually.</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:30px;">
        <thead>
          <tr style="background-color:#f8d7da;">
            <th style="border:1px solid #f5c6cb;padding:10px 12px;text-align:left;font-size:13px;">Error</th>
          </tr>
        </thead>
        <tbody>${errorRows}</tbody>
      </table>`
      : '';

  const nothingToDoSection = nothingToDo
    ? `<p style="color:#888;font-size:14px;margin-top:24px;">No companies were eligible for promotion in this run. All referred companies are either awaiting the 30-day window or have already been promoted.</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Med Alliance — Deployed Companies Promotion Report</title>
</head>
<body style="margin:0;padding:0;width:100%!important;background-color:#f4f4f4;">
  <div style="max-width:700px;margin:0 auto;background-color:#ffffff;">
    ${getEmailHeader()}

    <div style="padding:32px 24px;">
      <h2 style="color:#181D27;font-size:22px;margin-bottom:4px;">Med Alliance — Deployed Companies Report</h2>
      <p style="color:#666;font-size:14px;margin-top:0;margin-bottom:24px;">Daily cron run on ${formattedDate}</p>

      <div style="display:flex;gap:16px;margin-bottom:8px;" align="center">
        <div style="flex:1;background:${promoted.length > 0 ? '#e8f5e9' : '#f5f5f5'};border-radius:8px;padding:16px;text-align:center;margin:0 8px;">
          <p style="margin:0;font-size:13px;color:${promoted.length > 0 ? '#388e3c' : '#757575'};font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Companies Promoted</p>
          <p style="margin:8px 0 0;font-size:28px;font-weight:700;color:${promoted.length > 0 ? '#2e7d32' : '#9e9e9e'};">${promoted.length}</p>
        </div>
        <div style="flex:1;background:${totalCommissions > 0 ? '#e3f2fd' : '#f5f5f5'};border-radius:8px;padding:16px;text-align:center;margin:0 8px;">
          <p style="margin:0;font-size:13px;color:${totalCommissions > 0 ? '#1565c0' : '#757575'};font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Commissions Promoted</p>
          <p style="margin:8px 0 0;font-size:28px;font-weight:700;color:${totalCommissions > 0 ? '#0d47a1' : '#9e9e9e'};">${totalCommissions}</p>
        </div>
        <div style="flex:1;background:${errors.length > 0 ? '#fff3e0' : '#f5f5f5'};border-radius:8px;padding:16px;text-align:center;margin:0 8px;">
          <p style="margin:0;font-size:13px;color:${errors.length > 0 ? '#e65100' : '#757575'};font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Errors</p>
          <p style="margin:8px 0 0;font-size:28px;font-weight:700;color:${errors.length > 0 ? '#bf360c' : '#9e9e9e'};">${errors.length}</p>
        </div>
      </div>

      ${nothingToDoSection}
      ${promotedSection}
      ${errorsSection}
    </div>

    ${getEmailFooter()}
  </div>
</body>
</html>`;
}
