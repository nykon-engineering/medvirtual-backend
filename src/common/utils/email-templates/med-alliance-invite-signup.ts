import { getEmailFooter, getEmailLogoCss, getEmailLogoImg } from './components';
import { EmailTheme } from './theme';

export function MedAllianceInviteSignup(
  inviteLink: string,
  theme?: EmailTheme,
  firstName?: string,
): string {
  const primaryColor = theme?.primaryColor || '#01546B';
  const primaryColorHover = theme?.primaryColorHover || '#013A4F';
  const companyName = theme?.companyName || 'MedVirtual';
  const buttonColor = theme?.buttonColor || primaryColor;
  const buttonTextColor = theme?.buttonTextColor || '#ffffff';
  const greeting = firstName ? `Hello, ${firstName}!` : 'Hi,';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Med Alliance Partner Account Setup</title>
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
${getEmailLogoCss()}
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
    .main-message p {
      margin: 0 0 14px 0;
    }
    .cta-button {
      display: inline-block;
      background-color: ${buttonColor};
      color: ${buttonTextColor} !important;
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
      color: ${buttonTextColor} !important;
    }
    .cta-button:visited {
      color: ${buttonTextColor} !important;
    }
    .cta-button:link {
      color: ${buttonTextColor} !important;
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
    .note {
      color: #666666;
      font-size: 14px;
      margin-top: 20px;
      line-height: 1.5;
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
  </style>
</head>

<body>
  <div class="email-wrapper">
    <div class="container">
      <div class="content">
        <div class="logo">
          ${getEmailLogoImg(theme)}
        </div>

        <div class="greeting">${greeting}</div>

        <div class="main-message">
          <p>Thank you for becoming a MedVirtual Alliance Partner. Please click the button below to securely set your password and activate your account.</p>
          <p>Once you${'`'}re in, you can refer clients, track your referral status, and manage your commissions all in one place.</p>
          <p>You${'`'}ll also have access to our talent pool if you${'`'}d like to recommend specific virtual staff to your referrals.</p>
        </div>

        <div style="text-align: left; margin: 30px 0;">
          <a href="${inviteLink}" class="cta-button">
            Activate My Account and Get Started
          </a>
        </div>

        <p class="note"><strong>Important:</strong> This invitation expires in 48 hours. If it has expired, contact our support team to request a new one.</p>

        <div class="text-link">
          Having trouble with the button? Copy and paste this link into your browser:<br>
          <a href="${inviteLink}">${inviteLink}</a>
        </div>

        <div class="closing">Best,</div>
        <div class="sender">
          <strong>${companyName}</strong> team
        </div>
      </div>
      ${getEmailFooter(theme)}
    </div>
  </div>
</body>
</html>
`;
}
