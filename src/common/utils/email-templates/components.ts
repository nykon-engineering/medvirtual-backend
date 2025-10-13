const logo = `${process.env.FRONTEND_URL}/logo.png`;
const supportEmail = process.env.SUPPORT_EMAIL || 'support@medvirtual.ai';

export const EmailHeader = `
    <div style="background:#01546B;padding:40px 20px;text-align:center;">
        <img src="${logo}" alt="MedVirtual Logo" style="max-width: 200px; height: auto;" />
    </div>
`;

export const EmailFooter = `
    <div style="background-color:#f8f9fa;padding:30px 20px;text-align:center;border-top:1px solid #e9ecef;">
      <p style="color:#666666;font-size:14px;line-height:1.5;margin:5px 0;margin-top:20px;">
        MedVirtual © 2025. All rights reserved.
      </p>
      <div class="footer-links" style="margin-top: 20px; font-size: 12px;">
        <a href="mailto:${supportEmail}" style="color: #666666; text-decoration: none; margin: 0 10px;">Contact Support</a>
        <a href="mailto:unsubscribe@medvirtual.ai" style="color: #666666; text-decoration: none; margin: 0 10px;">Unsubscribe</a>
        <a href="${process.env.FRONTEND_URL}/privacy" style="color: #666666; text-decoration: none; margin: 0 10px;">Privacy Policy</a>
      </div>
    </div>
`;
