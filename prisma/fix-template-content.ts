/**
 * fix-template-content.ts
 *
 * Aligns the EmailTemplate rows already in the database with the exact
 * wording extracted from the hardcoded TypeScript fallback files in
 * /src/common/utils/email-templates/.
 *
 * Safe to run multiple times (upsert pattern: finds by key + null BU,
 * updates only the editable fields — does NOT touch id, created_at,
 * updated_by, is_active, or history rows).
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register prisma/fix-template-content.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Helper: upsert by key (business_unit = null = global) ─────────────────────

async function fix(patch: {
  key: string;
  name?: string;
  description?: string;
  subject: string;
  headline: string;
  body: string;
  button_label: string | null;
  button_url: string | null;
  placeholders: string[];
}) {
  const existing = await prisma.emailTemplate.findFirst({
    where: { key: patch.key, business_unit: null },
    select: { id: true },
  });

  if (existing) {
    await prisma.emailTemplate.update({
      where: { id: existing.id },
      data: {
        subject: patch.subject,
        headline: patch.headline,
        body: patch.body,
        button_label: patch.button_label,
        button_url: patch.button_url,
        placeholders: patch.placeholders,
        ...(patch.name && { name: patch.name }),
        ...(patch.description !== undefined && { description: patch.description }),
      },
    });
    console.log(`  ✅ updated  ${patch.key}`);
  } else {
    await prisma.emailTemplate.create({
      data: {
        key: patch.key,
        name: patch.name ?? patch.key,
        description: patch.description ?? null,
        subject: patch.subject,
        headline: patch.headline,
        body: patch.body,
        button_label: patch.button_label,
        button_url: patch.button_url,
        placeholders: patch.placeholders,
        business_unit: null,
        is_active: true,
      },
    });
    console.log(`  ➕ created  ${patch.key}`);
  }
}

// ── Corrections ───────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔧 Fixing 16 existing email templates...\n');

  // 1. invite-signup
  // Source: /src/common/utils/email-templates/invite-signup.ts
  // Original greeting: "Hi," — no explicit headline in .ts
  // "MedVirtual platform" is hardcoded in the .ts — we generalise with {{companyName}}
  await fix({
    key: 'invite-signup',
    name: 'User Invitation',
    description: 'Sent when a user is invited to the platform.',
    subject: '{{companyName}} Platform Invitation',
    headline: 'Hi,',
    body:
      'You have been invited to join the {{companyName}} platform. Please click the button below to easily and securely activate your account.\n\n' +
      'Once activated, you can manage your hired staff, submit new hire requests, and explore our candidate pool to source the right support for your team.\n\n' +
      '⏰ Important: This invitation will expire in 48 hours for security reasons.',
    button_label: 'Activate My Account',
    button_url: '{{inviteLink}}',
    placeholders: ['{{inviteLink}}', '{{companyName}}'],
  });

  // 2. reset-password
  // Source: /src/common/utils/email-templates/reset-password.ts
  // <title>: "Password Reset - ${companyName} Platform"
  // greeting: "Hi ${userName},"
  await fix({
    key: 'reset-password',
    name: 'Password Reset',
    description: 'Sent when a user requests a password reset.',
    subject: 'Password Reset - {{companyName}} Platform',
    headline: 'Hi {{userName}},',
    body:
      'We received a request to reset your password for your {{companyName}} account. Just click the button below to easily and securely create a new password :)\n\n' +
      '⏰ Important: This password reset link will expire in 10 minutes for security reasons.\n\n' +
      "If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.",
    button_label: 'Reset My Password',
    button_url: '{{resetLink}}',
    placeholders: ['{{userName}}', '{{resetLink}}', '{{companyName}}'],
  });

  // 3. verification-code
  // Source: /src/common/utils/email-templates/verification-code.ts
  // <title>: "Verify Your ${companyName} Account"
  // greeting: "Hi,"
  await fix({
    key: 'verification-code',
    name: 'Email Verification Code',
    description: 'Sent with the OTP code during account sign-up.',
    subject: 'Verify Your {{companyName}} Account',
    headline: 'Hi,',
    body:
      'Here is your verification code. Just enter the code below to easily and securely verify your account :)\n\n' +
      'Your code: {{verificationCode}}\n\n' +
      '⏰ Important: This code will expire in 10 minutes for security reasons.',
    button_label: 'Verify Account',
    button_url: '{{verificationUrl}}',
    placeholders: ['{{verificationCode}}', '{{verificationUrl}}', '{{companyName}}'],
  });

  // 4. schedule-interview
  // Source: /src/common/utils/email-templates/schedule-interview.ts
  // <title>: "${companyName} Platform Invitation"
  // greeting: "Hi,"
  await fix({
    key: 'schedule-interview',
    name: 'Schedule Interview',
    description: 'Sent to invite a candidate to schedule an interview.',
    subject: '{{companyName}} Platform Invitation',
    headline: 'Hi,',
    body:
      'You have been invited to join our healthcare platform. Just click the button below to easily and securely create your account :)\n\n' +
      '⏰ Important: This invitation will expire in 48 hours for security reasons.',
    button_label: 'Activate My Account',
    button_url: '{{inviteLink}}',
    placeholders: ['{{inviteLink}}', '{{companyName}}'],
  });

  // 5. med-alliance-invite-signup
  // Source: /src/common/utils/email-templates/med-alliance-invite-signup.ts
  // <title>: "Med Alliance Partner Account Setup"
  // greeting: "Hello, ${firstName}!" (or "Hi," if no firstName)
  await fix({
    key: 'med-alliance-invite-signup',
    name: 'Med Alliance — Affiliate Invitation (New User)',
    description: 'Sent to invite a new affiliate to the Med Alliance program (requires account setup).',
    subject: 'Med Alliance Partner Account Setup',
    headline: 'Hello, {{firstName}}!',
    body:
      'Thank you for becoming a {{companyName}} Alliance Partner. Please click the button below to securely set your password and activate your account.\n\n' +
      "Once you're in, you can refer clients, track your referral status, and manage your commissions all in one place.\n\n" +
      "You'll also have access to our talent pool if you'd like to recommend specific virtual staff to your referrals.\n\n" +
      'Important: This invitation expires in 48 hours. If it has expired, contact our support team to request a new one.',
    button_label: 'Activate My Account and Get Started',
    button_url: '{{inviteLink}}',
    placeholders: ['{{inviteLink}}', '{{firstName}}', '{{companyName}}'],
  });

  // 6. med-alliance-invitation
  // Source: /src/common/utils/email-templates/med-alliance-invitation.ts
  // <title>: "You've been invited to join the Med Alliance Program"
  // greeting: "Hello, ${firstName}!"
  // CTA: goes to /med-alliance (no inviteLink — existing user)
  await fix({
    key: 'med-alliance-invitation',
    name: 'Med Alliance — Partner Invitation (Existing User)',
    description: 'Sent to existing users invited to become Med Alliance partners.',
    subject: "You've been invited to join the Med Alliance Program",
    headline: 'Hello, {{firstName}}!',
    body:
      'Great news — you have been added to the Med Alliance Program by {{companyName}}.\n\n' +
      "As a Med Alliance Partner, your dashboard is ready. Here's what you now have access to:\n" +
      '- Commission earnings on every successful referral\n' +
      '- A dedicated partner dashboard with real-time tracking\n' +
      '- Transparent payout history and on-demand payout requests\n' +
      "- Full visibility into the organizations you've referred\n\n" +
      'Your partner profile is active. Log in to start tracking your referrals and commissions.\n\n' +
      'If you have any questions, please contact our support team.',
    button_label: 'Go to My Partner Dashboard',
    button_url: '{{platformUrl}}',
    placeholders: ['{{firstName}}', '{{companyName}}', '{{platformUrl}}'],
  });

  // 7. med-alliance-org-invitation
  // Source: /src/common/utils/email-templates/med-alliance-invitation-for-org-users.ts
  // <title>: "You've been invited to join the Med Alliance Program"
  // greeting: "Hello, ${firstName}!"
  await fix({
    key: 'med-alliance-org-invitation',
    name: 'Med Alliance — Organization User Invitation',
    description: 'Sent to organization users enrolled in the Med Alliance program.',
    subject: "You've been invited to join the Med Alliance Program",
    headline: 'Hello, {{firstName}}!',
    body:
      'Your Med Alliance Partner profile is now active.\n\n' +
      "By joining the Med Alliance Program with {{companyName}}, you've unlocked a new revenue stream directly from your existing network. Here's what's available to you right now:\n" +
      '- Commission earnings on every successful referral you make\n' +
      '- A dedicated partner dashboard with real-time referral tracking\n' +
      '- Transparent payout history and on-demand payout requests\n' +
      "- Full visibility into the organizations you've referred\n\n" +
      'Your dashboard is live — head over to review your partner profile and start sharing your referral link.\n\n' +
      'If you have any questions, please contact our support team.',
    button_label: 'View My Partner Dashboard',
    button_url: '{{platformUrl}}',
    placeholders: ['{{firstName}}', '{{companyName}}', '{{platformUrl}}'],
  });

  // 8. new-positions-alert
  // Source: /src/common/utils/email-templates/new-positions-alert.ts
  // Admin-only report — body is a table, kept as descriptive text
  await fix({
    key: 'new-positions-alert',
    name: 'New VA Positions Alert',
    description: 'Sent to admins when new VA positions are found in HubSpot without rate config.',
    subject: '[Action Required] New VA Positions Found',
    headline: '[Action Required] New VA Positions Found',
    body:
      'The following {{positionCount}} new position(s) were detected in HubSpot but are not yet configured in the system.\n\n' +
      'Please access the Rate Config panel in the admin dashboard to set the floor prices, hourly rates, and margin for each position.\n\n' +
      'Positions needing configuration:\n{{positionsList}}',
    button_label: null,
    button_url: null,
    placeholders: ['{{positionCount}}', '{{positionsList}}'],
  });

  // 9. quarterly-payout-report
  // Source: /src/common/utils/email-templates/quarterly-payout-report.ts
  await fix({
    key: 'quarterly-payout-report',
    name: 'Quarterly Payout Report',
    description: 'Sent to admins with quarterly automatic payout requests summary.',
    subject: 'Quarterly Report — Automatic Payout Requests',
    headline: 'Quarterly Report — Automatic Payout Requests',
    body:
      'Generated on {{reportDate}}\n\n' +
      'Successfully created: {{successCount}}\n' +
      'Total amount: {{totalAmount}}\n' +
      'Failed: {{failureCount}}\n\n' +
      'Details:\n{{reportContent}}',
    button_label: null,
    button_url: null,
    placeholders: ['{{reportDate}}', '{{successCount}}', '{{totalAmount}}', '{{failureCount}}', '{{reportContent}}'],
  });

  // 10. client-users-deactivation
  // Source: /src/common/utils/email-templates/client-users-deactivation-report.ts
  await fix({
    key: 'client-users-deactivation',
    name: 'Client Users Deactivation Report',
    description: 'Sent to admins with a report of deactivated client users.',
    subject: 'Client Users Deactivation Report',
    headline: 'Client Users Deactivation Report',
    body:
      'Hi there, below is the report for the Client Users Deactivation cron job run on {{reportDate}}.\n\n' +
      'This job targets clients with no staff and processes users created more than 60 days ago.\n\n' +
      'Users Deactivated: {{deactivatedCount}}\n' +
      'Invited Users Removed: {{removedCount}}\n\n' +
      'Details:\n{{reportContent}}',
    button_label: null,
    button_url: null,
    placeholders: ['{{reportDate}}', '{{deactivatedCount}}', '{{removedCount}}', '{{reportContent}}'],
  });

  // 11. med-alliance-deployed-companies
  // Source: /src/common/utils/email-templates/med-alliance-deployed-companies-report.ts
  await fix({
    key: 'med-alliance-deployed-companies',
    name: 'Med Alliance — Deployed Companies Report',
    description: 'Daily report sent to admins of companies promoted in Med Alliance.',
    subject: 'Med Alliance — Deployed Companies Report',
    headline: 'Med Alliance — Deployed Companies Report',
    body:
      'Daily cron run on {{reportDate}}\n\n' +
      'Companies Promoted: {{promotedCount}}\n' +
      'Commissions Promoted: {{totalCommissions}}\n' +
      'Errors: {{errorCount}}\n\n' +
      'Details:\n{{reportContent}}',
    button_label: null,
    button_url: null,
    placeholders: ['{{reportDate}}', '{{promotedCount}}', '{{totalCommissions}}', '{{errorCount}}', '{{reportContent}}'],
  });

  // 12. system-report
  // Source: /src/common/utils/email-templates/system-report.ts
  await fix({
    key: 'system-report',
    name: 'System Report',
    description: 'Daily automated system report sent to system admins.',
    subject: 'System Report',
    headline: 'Hi There, below is important data regarding candidates on our system.',
    body:
      'Available candidates: {{availableCount}}\n' +
      'Endorsed candidates: {{endorsedCount}}\n' +
      'Without resume link: {{withoutResumeCount}}\n' +
      'Failed resume parsing: {{failedParsingCount}}\n\n' +
      'Details:\n{{reportContent}}',
    button_label: null,
    button_url: null,
    placeholders: ['{{availableCount}}', '{{endorsedCount}}', '{{withoutResumeCount}}', '{{failedParsingCount}}', '{{reportContent}}'],
  });

  // 13. cron-job-error
  // Source: /src/common/utils/email-templates/cron-job-error-report.ts
  await fix({
    key: 'cron-job-error',
    name: 'Cron Job Error Report',
    description: 'Sent to system admins when a cron job fails.',
    subject: '[ERROR] Cron Job Failed — {{jobName}}',
    headline: 'Cron Job Failed',
    body:
      'The cron job {{jobName}} encountered an error on {{errorTime}} and did not complete successfully.\n\n' +
      'Error Message:\n{{errorMessage}}\n\n' +
      'Stack Trace:\n{{errorStack}}\n\n' +
      'Please investigate the issue and re-trigger the job manually if needed.',
    button_label: null,
    button_url: null,
    placeholders: ['{{jobName}}', '{{errorTime}}', '{{errorMessage}}', '{{errorStack}}'],
  });

  // 14. google-token-expired
  // Source: /src/common/utils/email-templates/googleTokenExpired.ts
  // Original had "Hi Paulo" hardcoded — generalised with {{recipientName}}
  await fix({
    key: 'google-token-expired',
    name: 'Google Token Expired',
    description: 'Sent to admins when a Google OAuth token expires.',
    subject: 'The Google Token is Expired',
    headline: 'Google Token Expired',
    body:
      'Hi {{recipientName}}, we have detected that your google token is expired. Please reconnect your google account to continue using our services.\n\n' +
      "Don't worry about the system. We have a cron job that will reprocess all failed candidates every day.",
    button_label: null,
    button_url: null,
    placeholders: ['{{recipientName}}'],
  });

  // 15. google-drive-failed
  // Source: /src/common/utils/email-templates/googledrive-failed.ts
  // Exact wording: "Hi MedVirtual Team, we got a error from ${candidateName} resume."
  await fix({
    key: 'google-drive-failed',
    name: 'Google Drive Failed',
    description: 'Sent to admins when a Google Drive operation fails while processing a resume.',
    subject: 'Google Drive Failed',
    headline: 'Google Drive Error',
    body:
      'Hi MedVirtual Team,\nwe got an error from {{candidateName}} resume.\n\n' +
      'Please, check file permissions and update it on hubspot.\n\n' +
      'Informations from google drive:\n{{messageError}}\n\n' +
      "Don't worry about the system. We have a cron job that will reprocess all failed candidates every day.",
    button_label: null,
    button_url: null,
    placeholders: ['{{candidateName}}', '{{messageError}}'],
  });

  // 16. openai-quota-exceeded
  // Source: /src/common/utils/email-templates/insufficient_quota-openai.ts
  // Original had "Hi Shayan" hardcoded — generalised with {{recipientName}}
  await fix({
    key: 'openai-quota-exceeded',
    name: 'OpenAI Quota Exceeded',
    description: 'Sent to admins when the OpenAI API quota is exceeded.',
    subject: 'Insufficient Quota from OpenAI',
    headline: 'OpenAI Quota Alert',
    body:
      'Hi {{recipientName}}, we have detected that your OpenAI account has insufficient quota to process further requests. Please review your OpenAI subscription and ensure you have enough credits to continue using our services.\n\n' +
      "Don't worry about the system. We have a cron job that will reprocess all failed candidates every day.",
    button_label: null,
    button_url: null,
    placeholders: ['{{recipientName}}'],
  });

  console.log('\n✅ All 16 templates corrected.\n');

  const total = await prisma.emailTemplate.count();
  console.log(`📊 Total EmailTemplate rows in DB: ${total}\n`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
