import { getEmailHeader, getEmailFooter } from './components';
import { EmailTheme } from './theme';

export default function getVerificationCodeTemplate(verificationCode: string, theme?: EmailTheme) {
  const primaryColor = theme?.primaryColor || '#01546B';
  const companyName = theme?.companyName || 'MedVirtual';
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify Your ${companyName} Account</title>
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
    .code-box {
      background-color: #f8f9fa;
      border: 2px dashed #00B2E2;
      border-radius: 12px;
      padding: 30px 20px;
      margin: 40px 0;
      text-align: center;
    }
    .code-label {
      color: #666666;
      font-size: 14px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 15px;
    }
    .verification-code {
      font-size: 36px;
      font-weight: 700;
      color: ${primaryColor};
      letter-spacing: 8px;
      font-family: 'Courier New', monospace;
      margin: 0;
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
  </style>
</head>

<body>
  <div class="container">
    ${getEmailHeader(theme)}

    <div class="content">
      <h2 style="color: #333333; font-size: 24px; margin-bottom: 20px;">
        Verify Your Account
      </h2>
      
      <p style="color: #333333; font-size: 18px; line-height: 1.6; margin-bottom: 40px;">
        Thank you for signing up! To complete your registration and verify your account,
        please use the verification code below.
      </p>

      <div class="code-box">
        <div class="code-label">
          Your Verification Code
        </div>
        <p class="verification-code">
          ${verificationCode}
        </p>
      </div>

      <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 30px 0;">
        Enter this code in the verification screen to activate your account.
        If you didn't request this verification, please ignore this email.
      </p>

      <div class="warning-box">
        <strong>⏰ Important:</strong> This code will expire in 10 minutes for security reasons.
      </div>
    </div>
    
    ${getEmailFooter(theme)}
  </div>
</body>
</html>
`;
}