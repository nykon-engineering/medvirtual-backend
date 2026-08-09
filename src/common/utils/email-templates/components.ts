import { EmailTheme } from './theme';

const supportEmail = process.env.SUPPORT_EMAIL || 'support@medvirtual.ai';

// Business unit logos are uploaded with arbitrary aspect ratios, so the header
// normalizes HEIGHT (not width) to keep every email header visually consistent.
export const EMAIL_LOGO_HEIGHT_PX = 40;
export const EMAIL_LOGO_MAX_WIDTH_PX = 200;

// Single source of truth for the logo URL. Falls back to the brand default only
// when the business unit has no logo configured in EmailBranding.
export function getLogoUrl(theme?: Partial<EmailTheme> | null): string {
  const companyName = theme?.companyName || 'MedVirtual';

  return (
    theme?.logoUrl ??
    `https://staging.medvirtual.ai/${companyName === 'Berry Virtual' ? 'logobv.png' : 'logo.png'}`
  );
}

// The `height` attribute is required because Outlook ignores max-width on images.
export function getEmailLogoImg(theme?: Partial<EmailTheme> | null): string {
  const companyName = theme?.companyName || 'MedVirtual';

  return `<img src="${getLogoUrl(theme)}" alt="${companyName} Logo" height="${EMAIL_LOGO_HEIGHT_PX}" style="height:${EMAIL_LOGO_HEIGHT_PX}px;width:auto;max-width:${EMAIL_LOGO_MAX_WIDTH_PX}px;display:block;" />`;
}

// For templates that keep a <style> block; pair with a `.logo` wrapper div.
export function getEmailLogoCss(): string {
  return `
    .logo { text-align: left; margin-bottom: 30px; }
    .logo img { height: ${EMAIL_LOGO_HEIGHT_PX}px; width: auto; max-width: ${EMAIL_LOGO_MAX_WIDTH_PX}px; display: block; }`;
}

export function getEmailHeader(theme?: EmailTheme) {
  const primaryColor = theme?.primaryColor || '#01546B';

  return `
    <div style="background:${primaryColor};padding:40px 20px;text-align:center;">
        <div style="display:inline-block;">${getEmailLogoImg(theme)}</div>
    </div>

  `;
}

export function getEmailFooter(theme?: EmailTheme) {
  const secondaryColor = theme?.secondaryColor || '#f8f9fa';
  const companyName = theme?.companyName || 'MedVirtual';

  return `
    <div style="background-color:${secondaryColor};padding:30px 20px;text-align:center;border-top:1px solid #e9ecef;">
      <p style="color:#666666;font-size:14px;line-height:1.5;margin:5px 0;margin-top:20px;">
        ${companyName} © 2025. All rights reserved.
      </p>
      <div class="footer-links" style="margin-top: 20px; font-size: 12px;">
        <a href="mailto:${supportEmail}" style="color: #666666; text-decoration: none; margin: 0 10px;">Contact Support</a>
        <a href="mailto:unsubscribe@medvirtual.ai" style="color: #666666; text-decoration: none; margin: 0 10px;">Unsubscribe</a>
        <a href="${process.env.FRONTEND_URL}/privacy" style="color: #666666; text-decoration: none; margin: 0 10px;">Privacy Policy</a>
      </div>
    </div>
  `;
}

// Legacy exports for backward compatibility
export const EmailHeader = getEmailHeader();
export const EmailFooter = getEmailFooter();
