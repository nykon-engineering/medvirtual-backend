import { getEmailHeader, getEmailFooter } from './components';

export interface ExpiredCompanyEntry {
  orgId: string;
  orgName: string;
  deploymentDate: string;
  previousStatus: string;
}

export default function medAllianceExpiredEligibilityReport(
  expired: ExpiredCompanyEntry[],
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

  const nothingToDo = expired.length === 0 && errors.length === 0;

  const expiredRows = expired
    .map(
      (e) => `
      <tr>
        <td style="border:1px solid #dee2e6;padding:10px 12px;font-size:14px;font-weight:600;">${e.orgName}</td>
        <td style="border:1px solid #dee2e6;padding:10px 12px;font-size:11px;color:#888;font-family:monospace;">${e.orgId}</td>
        <td style="border:1px solid #dee2e6;padding:10px 12px;font-size:14px;color:#555;text-align:center;">${e.deploymentDate}</td>
        <td style="border:1px solid #dee2e6;padding:10px 12px;font-size:14px;color:#555;text-align:center;">${e.previousStatus}</td>
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

  const expiredSection =
    expired.length > 0
      ? `
      <h3 style="color:#181D27;margin-top:32px;margin-bottom:12px;">Expired Companies (${expired.length})</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:30px;">
        <thead>
          <tr style="background-color:#f4f4f4;">
            <th style="border:1px solid #dee2e6;padding:10px 12px;text-align:left;font-size:13px;">Company</th>
            <th style="border:1px solid #dee2e6;padding:10px 12px;text-align:left;font-size:13px;">Org ID</th>
            <th style="border:1px solid #dee2e6;padding:10px 12px;text-align:center;font-size:13px;">Deployed At</th>
            <th style="border:1px solid #dee2e6;padding:10px 12px;text-align:center;font-size:13px;">Previous Status</th>
          </tr>
        </thead>
        <tbody>${expiredRows}</tbody>
      </table>`
      : '';

  const errorsSection =
    errors.length > 0
      ? `
      <h3 style="color:#721c24;margin-top:32px;margin-bottom:12px;">Errors (${errors.length})</h3>
      <p style="color:#721c24;font-size:14px;margin-bottom:16px;">The following companies could not be expired. Please review them manually.</p>
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
    ? `<p style="color:#888;font-size:14px;margin-top:24px;">No companies passed the 365-day deployment window in this run.</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Med Alliance — Expired Eligibility Report</title>
</head>
<body style="margin:0;padding:0;width:100%!important;background-color:#f4f4f4;">
  <div style="max-width:700px;margin:0 auto;background-color:#ffffff;">
    ${getEmailHeader()}

    <div style="padding:32px 24px;">
      <h2 style="color:#181D27;font-size:22px;margin-bottom:4px;">Med Alliance — Expired Eligibility Report</h2>
      <p style="color:#666;font-size:14px;margin-top:0;margin-bottom:24px;">Cron run on ${formattedDate}</p>

      <div style="display:flex;gap:16px;margin-bottom:8px;" align="center">
        <div style="flex:1;background:${expired.length > 0 ? '#fff3e0' : '#f5f5f5'};border-radius:8px;padding:16px;text-align:center;margin:0 8px;">
          <p style="margin:0;font-size:13px;color:${expired.length > 0 ? '#e65100' : '#757575'};font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Companies Expired</p>
          <p style="margin:8px 0 0;font-size:28px;font-weight:700;color:${expired.length > 0 ? '#bf360c' : '#9e9e9e'};">${expired.length}</p>
        </div>
        <div style="flex:1;background:${errors.length > 0 ? '#fff3e0' : '#f5f5f5'};border-radius:8px;padding:16px;text-align:center;margin:0 8px;">
          <p style="margin:0;font-size:13px;color:${errors.length > 0 ? '#e65100' : '#757575'};font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Errors</p>
          <p style="margin:8px 0 0;font-size:28px;font-weight:700;color:${errors.length > 0 ? '#bf360c' : '#9e9e9e'};">${errors.length}</p>
        </div>
      </div>

      ${nothingToDoSection}
      ${expiredSection}
      ${errorsSection}
    </div>

    ${getEmailFooter()}
  </div>
</body>
</html>`;
}
