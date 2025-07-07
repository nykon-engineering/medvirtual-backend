import { EmailHeader, EmailFooter } from "./components"

export default function getVerificationCodeTemplate(verificationCode: string) {
    return (`
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify Your Account</title>
</head>

<body style="margin:0;padding:0;width:100%!important;min-width:100%;background-color:#f4f4f4;font-family:monospace;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="max-width:600px;margin:0 auto;background-color:#ffffff;">
    ${EmailHeader}

    <div style="padding:40px 30px;text-align:center;">
      <p style="color:#333333;font-size:18px;line-height:1.6;margin-bottom:56px;">
        Thank you for signing up! To complete your registration and verify your account,
        please use the verification code below.
      </p>

      <div style="background-color:#f8f9fa;border:2px dashed #01546B;border-radius:12px;padding:30px 20px;margin:0px 0px 56px 0;text-align:center;">
        <div style="color:#666666;font-size:14px;font-weight:500;text-transform:uppercase;letter-spacing:1px;margin-bottom:15px;">
          Your Verification Code
        </div>
        <p style="font-size:36px;font-weight:700;color:#01546B;letter-spacing:8px;font-family:'Courier New', monospace;margin:0;">
          ${verificationCode}
        </p>
      </div>

      <p style="color:#666666;font-size:16px;line-height:1.6;margin:30px 0;">
        Enter this code in the verification screen to activate your account.
        If you didn't request this verification, please ignore this email.
      </p>

      <div style="background-color:#fff3cd;border:1px solid #ffeaa7;border-radius:8px;padding:15px;margin:25px 0;color:#856404;font-size:14px;">
        <strong>⏰ Important:</strong> This code will expire in 10 minutes for security reasons.
      </div>
    </div>
    ${EmailFooter}
  </div>
</body>
</html>
`)
}
