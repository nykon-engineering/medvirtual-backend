import { EmailHeader, EmailFooter } from "./components"

export default function getResetPasswordTemplate(userName: string, resetLink: string) {
    return (`
    <!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100&display=swap" rel="stylesheet"> <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * {
      font-family: "Be Vietnam Pro",
      font-style: normal
    }
  </style>
    <title>Password Reset - MedVirtual</title>
</head>

<body style="margin: 0; padding: 0; background-color: #f8fafc; line-height: 1.6;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">

        ${EmailHeader}

        <div style="padding: 40px;">
            <h2 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 600; color: #1e293b;">
                Reset Your Password
            </h2>

            <p style="margin: 0 0 24px 0; color: #475569; font-size: 16px;">
                Hello ${userName},
            </p>

            <p style="margin: 0 0 32px 0; color: #475569; font-size: 16px;">
                We received a request to reset your password. Click the button below to create a new password. This link will expire in 24 hours.
            </p>

            <div style="text-align: center; margin: 32px 0;">
                <a href="${resetLink}" style="display: inline-block; padding: 16px 32px; background-color: #00B2E2; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    Reset Password
                </a>
            </div>

            <p style="margin: 32px 0 0 0; color: #64748b; font-size: 14px;">
                If you didn't request this password reset, you can safely ignore this email.
            </p>
        </div>

        <div style="padding: 24px 40px; border-top: 1px solid #e2e8f0; text-align: center;">
            <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                MedVirtual © 2025
            </p>
        </div>

    </div>
</body>

</html>
`)
}
