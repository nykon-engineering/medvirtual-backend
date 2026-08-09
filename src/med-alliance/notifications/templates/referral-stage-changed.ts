import {
  getEmailFooter,
  getEmailLogoCss,
  getEmailLogoImg,
} from '../../../common/utils/email-templates/components';
import { EmailTheme } from '../../../common/utils/email-templates/theme';

export interface ReferralStageChangedPayload {
  firstName: string;
  organizationName: string;
  previousStage: string;
  newStage: string;
}

export function stageToLabel(stage: string): string {
  return stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function referralStageChangedTemplate(
  payload: ReferralStageChangedPayload,
  theme?: EmailTheme,
): string {
  const primaryColor = theme?.primaryColor || '#01546B';
  const primaryColorHover = theme?.primaryColorHover || '#013A4F';
  const companyName = theme?.companyName || 'MedVirtual';
  const buttonColor = theme?.buttonColor || primaryColor;
  const buttonTextColor = theme?.buttonTextColor || '#ffffff';
  const ctaLink = `${process.env.FRONTEND_URL}/modules/alliance/partner/referred`;

  const stageLabel = stageToLabel;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${payload.organizationName} has moved to a new stage</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
    .email-wrapper { background-color: #f4f4f4; padding: 20px; min-height: 100vh; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
    .content { padding: 40px 30px; }
${getEmailLogoCss()}
    .greeting { color: #333333; font-size: 16px; margin-bottom: 20px; }
    .main-message { color: #333333; font-size: 16px; line-height: 1.5; margin-bottom: 30px; }
    .stage-box { display: flex; align-items: center; gap: 12px; background-color: #f8f9fa; border-radius: 8px; padding: 16px 20px; margin: 20px 0; }
    .stage-pill { background-color: #e9ecef; color: #495057; padding: 6px 14px; border-radius: 20px; font-size: 14px; font-weight: 600; }
    .stage-pill.new { background-color: ${primaryColor}; color: #ffffff; }
    .stage-arrow { font-size: 18px; color: #868e96; }
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
          ${getEmailLogoImg(theme)}
        </div>
        <div class="greeting">Hi ${payload.firstName},</div>
        <div class="main-message">
          <p>Good news — <strong>${payload.organizationName}</strong> has progressed to a new stage in the Med Alliance pipeline! Here's what changed:</p>
          <div class="stage-box">
            <span class="stage-pill">${stageLabel(payload.previousStage)}</span>
            <span class="stage-arrow">→</span>
            <span class="stage-pill new">${stageLabel(payload.newStage)}</span>
          </div>
          <p>Log in to your partner dashboard to see the full status of all your referred companies and track their progress toward deployment.</p>
        </div>
        <div style="text-align: left; margin: 30px 0;">
          <a href="${ctaLink}" class="cta-button">View My Referrals</a>
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
