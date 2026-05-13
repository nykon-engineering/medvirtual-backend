import { EmailTheme } from './theme';

const logo = `${process.env.FRONTEND_URL}/logo.png`;
const supportEmail = process.env.SUPPORT_EMAIL || 'support@medvirtual.ai';

export function getEmailHeader(theme?: EmailTheme) {
  const primaryColor = theme?.primaryColor || '#01546B';
  const companyName = theme?.companyName || 'MedVirtual';

  return `
    <div style="background:${primaryColor};padding:40px 20px;text-align:center;">
        <img src="https://staging.medvirtual.ai/${companyName === 'Berry Virtual' ? 'logobv.png' : 'logo.png'}" alt="${companyName} Logo" style="max-width: 200px; height: auto;" />
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
