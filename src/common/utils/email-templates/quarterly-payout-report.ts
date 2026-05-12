import { getEmailHeader, getEmailFooter } from './components';

export interface PayoutReportEntry {
  affiliateName: string;
  affiliateEmail: string;
  commissionCount: number;
  totalAmount: string;
  payoutRequestId: string;
}

export interface PayoutReportFailure {
  affiliateName: string;
  affiliateEmail: string;
  error: string;
}

export default function quarterlyPayoutReport(
  successes: PayoutReportEntry[],
  failures: PayoutReportFailure[],
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

  const totalAmount = successes
    .reduce((sum, s) => sum + parseFloat(s.totalAmount), 0)
    .toFixed(2);

  const successRows = successes
    .map(
      (entry) => `
      <tr>
        <td style="border:1px solid #dee2e6;padding:10px 12px;font-size:14px;">${entry.affiliateName}</td>
        <td style="border:1px solid #dee2e6;padding:10px 12px;font-size:14px;color:#555;">${entry.affiliateEmail}</td>
        <td style="border:1px solid #dee2e6;padding:10px 12px;font-size:14px;text-align:center;">${entry.commissionCount}</td>
        <td style="border:1px solid #dee2e6;padding:10px 12px;font-size:14px;text-align:right;font-weight:600;">$${parseFloat(entry.totalAmount).toFixed(2)}</td>
        <td style="border:1px solid #dee2e6;padding:10px 12px;font-size:11px;color:#888;font-family:monospace;">${entry.payoutRequestId}</td>
      </tr>`,
    )
    .join('');

  const failureRows = failures
    .map(
      (f) => `
      <tr>
        <td style="border:1px solid #f5c6cb;padding:10px 12px;font-size:14px;">${f.affiliateName}</td>
        <td style="border:1px solid #f5c6cb;padding:10px 12px;font-size:14px;color:#555;">${f.affiliateEmail}</td>
        <td style="border:1px solid #f5c6cb;padding:10px 12px;font-size:13px;color:#721c24;">${f.error}</td>
      </tr>`,
    )
    .join('');

  const failuresSection =
    failures.length > 0
      ? `
      <h3 style="color:#721c24;margin-top:40px;margin-bottom:12px;">Failed Affiliates (${failures.length})</h3>
      <p style="color:#721c24;font-size:14px;margin-bottom:16px;">The following affiliates could not be processed. Please review and create their payout requests manually.</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:30px;">
        <thead>
          <tr style="background-color:#f8d7da;">
            <th style="border:1px solid #f5c6cb;padding:10px 12px;text-align:left;font-size:13px;">Affiliate</th>
            <th style="border:1px solid #f5c6cb;padding:10px 12px;text-align:left;font-size:13px;">Email</th>
            <th style="border:1px solid #f5c6cb;padding:10px 12px;text-align:left;font-size:13px;">Reason</th>
          </tr>
        </thead>
        <tbody>${failureRows}</tbody>
      </table>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Quarterly Payout Report</title>
</head>
<body style="margin:0;padding:0;width:100%!important;background-color:#f4f4f4;">
  <div style="max-width:700px;margin:0 auto;background-color:#ffffff;">
    ${getEmailHeader()}

    <div style="padding:32px 24px;">
      <h2 style="color:#181D27;font-size:22px;margin-bottom:4px;">Quarterly Report — Automatic Payout Requests</h2>
      <p style="color:#666;font-size:14px;margin-top:0;margin-bottom:24px;">Generated on ${formattedDate}</p>

      <div style="display:flex;gap:16px;margin-bottom:32px;" align="center">
        <div style="flex:1;background:#e8f5e9;border-radius:8px;padding:16px;text-align:center;margin:0 8px;">
          <p style="margin:0;font-size:13px;color:#388e3c;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Processed</p>
          <p style="margin:8px 0 0;font-size:28px;font-weight:700;color:#2e7d32;">${successes.length}</p>
        </div>
        <div style="flex:1;background:#e3f2fd;border-radius:8px;padding:16px;text-align:center;margin:0 8px;">
          <p style="margin:0;font-size:13px;color:#1565c0;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Total Amount</p>
          <p style="margin:8px 0 0;font-size:28px;font-weight:700;color:#0d47a1;">$${totalAmount}</p>
        </div>
        <div style="flex:1;background:${failures.length > 0 ? '#fff3e0' : '#f5f5f5'};border-radius:8px;padding:16px;text-align:center;margin:0 8px;">
          <p style="margin:0;font-size:13px;color:${failures.length > 0 ? '#e65100' : '#757575'};font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Failed</p>
          <p style="margin:8px 0 0;font-size:28px;font-weight:700;color:${failures.length > 0 ? '#bf360c' : '#9e9e9e'};">${failures.length}</p>
        </div>
      </div>

      <h3 style="color:#181D27;margin-bottom:12px;">Successfully Created (${successes.length})</h3>
      ${
        successes.length > 0
          ? `<table style="width:100%;border-collapse:collapse;margin-bottom:30px;">
        <thead>
          <tr style="background-color:#f4f4f4;">
            <th style="border:1px solid #dee2e6;padding:10px 12px;text-align:left;font-size:13px;">Affiliate</th>
            <th style="border:1px solid #dee2e6;padding:10px 12px;text-align:left;font-size:13px;">Email</th>
            <th style="border:1px solid #dee2e6;padding:10px 12px;text-align:center;font-size:13px;">Commissions</th>
            <th style="border:1px solid #dee2e6;padding:10px 12px;text-align:right;font-size:13px;">Amount</th>
            <th style="border:1px solid #dee2e6;padding:10px 12px;text-align:left;font-size:13px;">Payout Request ID</th>
          </tr>
        </thead>
        <tbody>${successRows}</tbody>
      </table>`
          : `<p style="color:#888;font-size:14px;">No payout requests were created.</p>`
      }

      ${failuresSection}
    </div>

    ${getEmailFooter()}
  </div>
</body>
</html>`;
}
