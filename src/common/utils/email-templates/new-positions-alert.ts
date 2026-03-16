import { EmailHeader, EmailFooter } from './components';

export default function newPositionsAlert(newPositions: string[]): string {
  const positionRows = newPositions
    .map(
      (position) => `
        <tr>
          <td style="border: 1px solid #ccc; padding: 10px; text-align: left;">
            ${position}
          </td>
          <td style="border: 1px solid #ccc; padding: 10px; text-align: center; color: #e67e22; font-weight: bold;">
            Needs Configuration
          </td>
        </tr>
      `,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New VA Positions Found</title>
</head>
<body style="margin:0;padding:0;width:100%!important;background-color:#f4f4f4;">
  <div style="max-width:600px;margin:0 auto;background-color:#ffffff;">
    ${EmailHeader}

    <div style="padding:20px 15px;text-align:center;">
      <h2 style="color:#181D27;font-size:20px;">[Action Required] New VA Positions Found</h2>
      <p style="color:#555;font-size:15px;line-height:1.6;">
        The following <strong>${newPositions.length}</strong> new position(s) were detected in HubSpot
        but are not yet configured in the system. Please access the
        <strong>Rate Config</strong> panel in the admin dashboard to set the
        floor prices, hourly rates, and margin for each position.
      </p>
    </div>

    <table style="width:100%;border-collapse:collapse;margin:0 15px 20px;width:calc(100% - 30px);">
      <thead>
        <tr style="background-color:#f4f4f4;">
          <th style="border:1px solid #ccc;padding:10px;text-align:left;">Position</th>
          <th style="border:1px solid #ccc;padding:10px;text-align:center;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${positionRows}
      </tbody>
    </table>

    ${EmailFooter}
  </div>
</body>
</html>`;
}
