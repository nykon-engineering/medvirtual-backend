import { getEmailFooter } from '../../../common/utils/email-templates/components';
import { EmailTheme } from '../../../common/utils/email-templates/theme';

export interface PayoutPaidPayload {
  firstName: string;
  totalAmount: number;
  paidAt: Date;
}

export function payoutPaidTemplate(
  payload: PayoutPaidPayload,
  theme?: EmailTheme,
): string {
  const primaryColor = theme?.primaryColor || '#01546B';
  const primaryColorHover = theme?.primaryColorHover || '#013A4F';
  const companyName = theme?.companyName || 'MedVirtual';
  const ctaLink = `${process.env.FRONTEND_URL}/modules/alliance/partner/payouts`;
  const logo = `https://staging.medvirtual.ai/${companyName === 'Berry Virtual' ? 'logobv.png' : 'logo.png'}`;
  const paidDate = payload.paidAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your payout has been processed</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
    .email-wrapper { background-color: #f4f4f4; padding: 20px; min-height: 100vh; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
    .content { padding: 40px 30px; }
    .logo { text-align: left; margin-bottom: 30px; }
    .logo img { max-width: 200px; height: auto; }
    .greeting { color: #333333; font-size: 16px; margin-bottom: 20px; }
    .main-message { color: #333333; font-size: 16px; line-height: 1.5; margin-bottom: 30px; }
    .highlight-box { background-color: #f0f9f0; border-left: 4px solid ${primaryColor}; padding: 16px 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
    .highlight-box .amount { font-size: 28px; font-weight: 700; color: ${primaryColor}; }
    .highlight-box .detail { font-size: 14px; color: #666666; margin-top: 4px; }
    .cta-button { display: inline-block; background-color: ${primaryColor}; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 30px; font-weight: 600; font-size: 16px; margin: 20px 0; }
    .cta-button:hover { background-color: ${primaryColorHover}; }
    .closing { color: #333333; font-size: 16px; margin: 30px 0 10px 0; }
    .sender { color: #333333; font-size: 16px; }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="container">
      <div class="content">
        <div class="logo">
          <img src="${logo}" alt="${companyName} Logo" />
        </div>
        <div class="greeting">Hi ${payload.firstName},</div>
        <div class="main-message">
          <p>Your payout has been sent! The funds are on their way and should arrive according to your payout method's typical timeline.</p>
          <div class="highlight-box">
            <div class="amount">$${payload.totalAmount.toFixed(2)}</div>
            <div class="detail">Sent on ${paidDate}</div>
          </div>
          <p>You can view this payment and your full payout history in your partner dashboard.</p>
        </div>
        <div style="text-align: left; margin: 30px 0;">
          <a href="${ctaLink}" class="cta-button">View My Payouts</a>
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
