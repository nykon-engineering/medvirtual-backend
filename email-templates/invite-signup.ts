import { EmailHeader, EmailFooter } from "./components"

export default function InviteSignup(inviteLink: string){

    return (
        `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invite Signup</title>
</head>

<body style="margin:0;padding:0;width:100%!important;min-width:100%;background-color:#f4f4f4;font-family:monospace;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="max-width:600px;margin:0 auto;background-color:#ffffff;">
    ${EmailHeader}

    <div style="padding:40px 30px;text-align:center;">
      <p style="color:#333333;font-size:18px;line-height:1.6;margin-bottom:32px;">
        You've been invited to join <strong>MedVirtual</strong>! Click the button below to create your account and get started.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${inviteLink}" style="display: inline-block; padding: 16px 32px; background-color: #01546B; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin-bottom:16px">
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
        `
    )
}