import { EmailFooter } from './components';

export default function InviteSignup(inviteLink: string) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100&display=swap" rel="stylesheet"> <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * {
      font-family: "Be Vietnam Pro",
      font-style: normal
    }
  </style>
  <title>Invite Signup</title>
</head>

<body style="margin:0;padding:0;width:100%!important;min-width:100%;background-color:#f4f4f4;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="max-width:600px;margin:0 auto;background-color:#ffffff;">
    <div style="background:#00B2E2;padding:40px 20px;text-align:center;">
        <img src="https://staging.medvirtual.ai/logo.png" alt="MedVirtual Logo" style="max-width: 200px; height: auto;" />
    </div>

    <div style="padding:40px 30px;text-align:center;">
      <p style="color:#333333;font-size:18px;line-height:1.6;margin-bottom:32px;">
        You've been invited to join <strong>MedVirtual</strong>! Click the button below to create your account and get started.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${inviteLink}" style="display: inline-block; padding: 16px 32px; background-color: #00B2E2; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin-bottom:16px">
          Accept Invite
        </a>
      </div>

      <p style="color:#666666;font-size:16px;line-height:1.6;margin:30px 0;">
        If you did not expect this invitation, you can safely ignore this message.
      </p>

      <div style="background-color:#fff3cd;border:1px solid #ffeaa7;border-radius:8px;padding:15px;margin:25px 0;color:#856404;font-size:14px;">
        <strong>⏰ Note:</strong> This invitation link will expire in 24 hours.
      </div>
    </div>

    ${EmailFooter}
  </div>
</body>
</html>
        `;
}
