import { getEmailHeader, getEmailFooter } from './components';
import { EmailTheme } from './theme';

export default function getResetPasswordTemplate(
  userName: string,
  resetLink: string,
  theme?: EmailTheme
) {
  const primaryColor = theme?.primaryColor || '#01546B';
  const primaryColorHover = theme?.primaryColorHover || '#013A4F';
  const companyName = theme?.companyName || 'MedVirtual';
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Password Reset - ${companyName} Platform</title>
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
      background-color: ${primaryColor};
      color: #ffffff;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
    }
    .button:hover {
      background-color: ${primaryColorHover};
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
    .text-link {
      color: #666666;
      font-size: 12px;
      word-break: break-all;
    }
    .text-link a {
      color: ${primaryColor};
      text-decoration: none;
    }
  </style>
</head>

<body>
  <div class="container">
    ${getEmailHeader(theme)}

    <div class="content">
      <h2 style="color: #333333; font-size: 24px; margin-bottom: 20px;">
        Reset Your Password
      </h2>
      
      <p style="color: #333333; font-size: 18px; line-height: 1.6; margin-bottom: 20px;">
        Hello ${userName},
      </p>
      
      <p style="color: #333333; font-size: 18px; line-height: 1.6; margin-bottom: 32px;">
        We received a request to reset your password for your ${companyName} account. Click the button below to create a new password.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetLink}" class="button" style="color: #ffffff !important;">
          Reset My Password
        </a>
      </div>

      <div class="warning-box">
        <strong>⏰ Important:</strong> This password reset link will expire in 10 minutes for security reasons.
      </div>

      <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 30px 0;">
        If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
      </p>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      
      <p class="text-link">
        Having trouble with the button? Copy and paste this link into your browser:<br>
        <a href="${resetLink}">${resetLink}</a>
      </p>
    </div>

    ${getEmailFooter(theme)}
  </div>
</body>
</html>
`;
}
