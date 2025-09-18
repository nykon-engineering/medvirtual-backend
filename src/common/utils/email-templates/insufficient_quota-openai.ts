import { EmailHeader, EmailFooter } from './components';

export default function insufficient_quota() {
  return `
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100&display=swap" rel="stylesheet"> <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * {
      font-family: "Be Vietnam Pro",
      font-style: normal
    }
  </style>
  <title>Insufficient Quota from OpenAI</title>
</head>

<body style="margin:0;padding:0;width:100%!important;min-width:100%;background-color:#f4f4f4;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="max-width:600px;margin:0 auto;background-color:#ffffff;">
    ${EmailHeader}

    <div style="padding:40px 30px;text-align:center;">
      <p style="color:#333333;font-size:18px;line-height:1.6;margin-bottom:56px;">
        Hi Shayan, we have detected that your OpenAI account has insufficient quota to process further requests. Please review your OpenAI subscription and ensure you have enough credits to continue using our services.
      </p>


      <p style="color:#666666;font-size:16px;line-height:1.6;margin:30px 0;">
        Don't worry about the system. We have a cron job that will reprocess all failed candidates every day.
      </p>

      
    </div>
    ${EmailFooter}
  </div>
</body>
</html>
`;
}
