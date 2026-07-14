import { getEmailFooter } from '../../../common/utils/email-templates/components';
import { EmailTheme } from '../../../common/utils/email-templates/theme';

export interface PayoutCancelledPayload {
  firstName: string;
  totalAmount: number;
  cancellationReason?: string;
}

export function payoutCancelledTemplate(
  payload: PayoutCancelledPayload,
  theme?: EmailTheme,
): string {
  const primaryColor = theme?.primaryColor || '#01546B';
  const primaryColorHover = theme?.primaryColorHover || '#013A4F';
  const companyName = theme?.companyName || 'MedVirtual';
  const buttonColor = theme?.buttonColor || primaryColor;
  const buttonTextColor = theme?.buttonTextColor || '#ffffff';
  const ctaLink = `${process.env.FRONTEND_URL}/modules/alliance/partner/payouts`;
  const logo = `https://staging.medvirtual.ai/${companyName === 'Berry Virtual' ? 'logobv.png' : 'logo.png'}`;

  const reasonBlock = payload.cancellationReason
    ? `<div class="reason-box">
        <div class="reason-label">Why it was cancelled</div>
        <div class="reason-text">${payload.cancellationReason}</div>
      </div>`
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your payout request has been cancelled</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
    .email-wrapper { background-color: #f4f4f4; padding: 20px; min-height: 100vh; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
    .content { padding: 40px 30px; }
    .logo { text-align: left; margin-bottom: 30px; }
    .logo img { max-width: 200px; height: auto; }
    .greeting { color: #333333; font-size: 16px; margin-bottom: 20px; }
    .main-message { color: #333333; font-size: 16px; line-height: 1.5; margin-bottom: 30px; }
    .highlight-box { background-color: #fff8f0; border-left: 4px solid #e07820; padding: 16px 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
    .highlight-box .amount { font-size: 28px; font-weight: 700; color: #e07820; }
    .highlight-box .detail { font-size: 14px; color: #666666; margin-top: 4px; }
    .reason-box { background-color: #f8f8f8; border-left: 4px solid #cccccc; padding: 14px 18px; margin: 20px 0; border-radius: 0 8px 8px 0; }
    .reason-label { font-size: 12px; color: #888888; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .reason-text { font-size: 15px; color: #333333; line-height: 1.5; }
    .cta-button { display: inline-block; background-color: ${buttonColor}; color: ${buttonTextColor} !important; padding: 14px 28px; text-decoration: none; border-radius: 30px; font-weight: 600; font-size: 16px; margin: 20px 0; }
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
          <p>We wanted to let you know that your recent payout request has been cancelled by our team.</p>
          <div class="highlight-box">
            <div class="amount">$${payload.totalAmount.toFixed(2)}</div>
            <div class="detail">Cancelled payout amount</div>
          </div>
          ${reasonBlock}
          <p>The good news: all commissions from this request have been returned to your available balance. You can submit a new payout request for them at any time from your dashboard.</p>
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
