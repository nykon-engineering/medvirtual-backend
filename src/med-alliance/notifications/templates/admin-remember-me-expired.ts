import {
  getEmailFooter,
  getEmailLogoCss,
  getEmailLogoImg,
} from '../../../common/utils/email-templates/components';
import { EmailTheme } from '../../../common/utils/email-templates/theme';

export function adminRememberMeExpiredTemplate(theme?: EmailTheme): string {
  const companyName = theme?.companyName || 'MedVirtual';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bill.com rememberMeId expired</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
    .email-wrapper { background-color: #f4f4f4; padding: 20px; min-height: 100vh; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
    .content { padding: 40px 30px; }
${getEmailLogoCss()}
    .alert-banner { background-color: #fff5f5; border-left: 4px solid #e03131; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-bottom: 20px; color: #c92a2a; font-weight: 600; font-size: 15px; }
    .main-message { color: #333333; font-size: 16px; line-height: 1.5; margin-bottom: 30px; }
    .steps { background-color: #f8f9fa; border-radius: 8px; padding: 16px 20px; margin: 20px 0; }
    .steps ol { margin: 0; padding-left: 20px; color: #333333; font-size: 15px; line-height: 1.8; }
    .code { font-family: monospace; font-size: 13px; background-color: #e9ecef; padding: 2px 6px; border-radius: 4px; }
    .closing { color: #333333; font-size: 16px; margin: 30px 0 10px 0; }
    .sender { color: #333333; font-size: 16px; }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="container">
      <div class="content">
        <div class="logo">
          ${getEmailLogoImg(theme)}
        </div>
        <div class="alert-banner">Action required: Bill.com rememberMeId has expired (BDC_1109)</div>
        <div class="main-message">
          <p>
            The Bill.com <strong>rememberMeId</strong> stored in the database has expired. All payment
            initiations are failing because the API session cannot be established with MFA trust.
          </p>
          <p>To restore payments, generate a new <span class="code">rememberMeId</span> by completing the MFA flow:</p>
          <div class="steps">
            <ol>
              <li>Call <span class="code">POST /v3/mfa/challenge</span> to trigger an SMS token to the registered phone number.</li>
              <li>Call <span class="code">POST /v3/mfa/challenge/validate</span> with the <span class="code">challengeId</span> and the received token to get a new <span class="code">rememberMeId</span>.</li>
              <li>Update the <span class="code">BillComCredential</span> record in the database with the new <span class="code">rememberMeId</span>.</li>
            </ol>
          </div>
          <p>The <span class="code">rememberMeId</span> is valid for 180 days from the date of issue.</p>
        </div>
        <div class="closing">Best,</div>
        <div class="sender"><strong>${companyName}</strong> team</div>
      </div>
      ${getEmailFooter(theme)}
    </div>
  </div>
</body>
</html>
`;
}
