import { EmailFooter, EmailHeader } from './components';

export default function InviteSignup(inviteLink: string) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MedVirtual Platform Invitation</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .content {
      padding: 40px 30px;
      text-align: center;
    }
    .button {
      display: inline-block;
      padding: 16px 32px;
      background-color: #01546B;
      color: #ffffff;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
    }
    .button:hover {
      background-color: #013A4F;
    }
    .warning-box {
      background-color: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 8px;
      padding: 15px;
      margin: 25px 0;
      color: #856404;
      font-size: 14px;
    }
    .footer-links {
      margin-top: 20px;
      font-size: 12px;
    }
    .footer-links a {
      color: #666666;
      text-decoration: none;
      margin: 0 10px;
    }
    .footer-links a:hover {
      text-decoration: underline;
    }
    .text-link {
      color: #666666;
      font-size: 12px;
      word-break: break-all;
    }
    .text-link a {
      color: #01546B;
      text-decoration: none;
    }
  </style>
</head>

<body>
  <div class="container">
    ${EmailHeader}

    <div class="content">
      <h2 style="color: #333333; font-size: 24px; margin-bottom: 20px;">
        Welcome to MedVirtual Platform
      </h2>
      
      <p style="color: #333333; font-size: 18px; line-height: 1.6; margin-bottom: 32px;">
        You have been invited to join our healthcare platform. Click the button below to create your account and get started with your new workspace.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${inviteLink}" class="button" style="color: #ffffff !important;">
          Create My Account
        </a>
      </div>

      <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 30px 0;">
        If you did not expect this invitation, you can safely ignore this message.
      </p>

      <div class="warning-box">
        <strong>⏰ Important:</strong> This invitation link will expire in 24 hours for security reasons.
      </div>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      
      <p class="text-link">
        Having trouble with the button? Copy and paste this link into your browser:<br>
        <a href="${inviteLink}">${inviteLink}</a>
      </p>
    </div>

    ${EmailFooter}
  </div>
</body>
</html>
        `;
}
