import { getEmailFooter, getEmailHeader } from './components';
import { EmailTheme } from './theme';

export default function scheduleInterview(inviteLink: string, theme?: EmailTheme) {
  const primaryColor = theme?.primaryColor || '#01546B';
  const primaryColorHover = theme?.primaryColorHover || '#013A4F';
  const companyName = theme?.companyName || 'MedVirtual';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${companyName} Platform Invitation</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    .email-wrapper {
      background-color: #f4f4f4;
      padding: 20px;
      min-height: 100vh;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .content {
      padding: 40px 30px;
    }
    .logo {
      text-align: left;
      margin-bottom: 30px;
    }
    .logo img {
      max-width: 200px;
      height: auto;
    }
    .greeting {
      color: #333333;
      font-size: 16px;
      margin-bottom: 20px;
    }
    .main-message {
      color: #333333;
      font-size: 16px;
      line-height: 1.5;
      margin-bottom: 30px;
    }
    .cta-button {
      display: inline-block;
      background-color: ${primaryColor};
      color: #ffffff !important;
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 30px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
      transition: background-color 0.2s ease;
    }
    .cta-button:hover {
      background-color: ${primaryColorHover};
      color: #ffffff !important;
    }
    .cta-button:visited {
      color: #ffffff !important;
    }
    .cta-button:link {
      color: #ffffff !important;
    }
    .closing {
      color: #333333;
      font-size: 16px;
      margin: 30px 0 10px 0;
    }
    .sender {
      color: #333333;
      font-size: 16px;
    }
    .text-link {
      color: #666666;
      font-size: 12px;
      word-break: break-all;
      margin-top: 20px;
    }
    .text-link a {
      color: ${primaryColor};
      text-decoration: none;
    }
    .footer {
      border-top: 1px solid #e9ecef;
      padding: 20px 30px;
      margin-top: 30px;
    }
    .footer-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .support-text {
      color: #666666;
      font-size: 14px;
      margin: 0;
    }
    .support-email {
      color: ${primaryColor};
      text-decoration: none;
      font-size: 14px;
    }
    .support-email-highlight {
      background-color: #fff3cd;
      padding: 1px 3px;
      border-radius: 2px;
    }
  </style>
</head>

<body>
  <div class="email-wrapper">
    <div class="container">
      <div class="content">
        <div class="logo">
          <img src="https://staging.medvirtual.ai/${theme?.companyName === 'Berry Virtual' ? 'logobv.png' : 'logo.png'}" alt="${companyName} Logo" />
        </div>
      
      <div class="greeting">Hi,</div>
      
      <div class="main-message">
        You have been invited to join our healthcare platform. Just click the button below to easily and securely create your account :)
      </div>

      <div style="text-align: left; margin: 30px 0;">
        <a href="${inviteLink}" class="cta-button">
          Activate My Account
        </a>
      </div>

      <strong>⏰ Important:</strong> This invitation will expire in 24 hours for security reasons.
   
      <div class="text-link">
        Having trouble with the button? Copy and paste this link into your browser:<br>
        <a href="${inviteLink}">${inviteLink}</a>
      </div>
      
      <div class="closing">Best,</div>
      <div class="sender">
        <strong>${companyName}</strong> team
      </div>
    </div>
    
  </div>
</body>
</html>
`;
}