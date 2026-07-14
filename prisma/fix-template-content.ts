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

  console.log('\n✅ All 16 existing templates corrected.');
  console.log('\n🔧 Adding 20 new HR/Tickets templates...\n');

  // ── HIRE REQUEST templates ──────────────────────────────────────────────────

  // 17. hr-placement-completed
  // Source: notifyHireRequestPlacementCompleted in notifications.service.ts
  await fix({
    key: 'hr-placement-completed',
    name: 'Hire Request — Placement Completed',
    description: 'Sent to assignees when a hire request is marked as placement completed.',
    subject: 'Placement completed: {{hrTitle}}',
    headline: 'Placement Completed',
    body:
      'The hire request has been marked as placement completed.\n\n' +
      'Title: {{hrTitle}}\n' +
      'Organization: {{orgName}}\n' +
      'Description: {{hrDescription}}\n' +
      'Salary Range: {{salaryRange}}\n' +
      'Expected Start Date: {{startDate}}\n\n' +
      'Selected Candidates:\n{{selectedCandidates}}\n\n' +
      'Please proceed with onboarding steps.',
    button_label: 'View Hire Request Details',
    button_url: '{{hrLink}}',
    placeholders: ['{{hrTitle}}', '{{orgName}}', '{{hrDescription}}', '{{salaryRange}}', '{{startDate}}', '{{selectedCandidates}}', '{{hrLink}}'],
  });

  // 18. hr-interview-scheduled
  // Source: notifyInterviewScheduled in notifications.service.ts
  await fix({
    key: 'hr-interview-scheduled',
    name: 'Hire Request — Interview Scheduled',
    description: 'Sent to all active organization users when an interview is scheduled.',
    subject: 'Interview Invite: {{roleType}} - {{availability}}',
    headline: 'You have been invited to an Interview.',
    body:
      'Title: {{hrTitle}}\n' +
      'Company: {{orgName}}\n' +
      'Expected Start Date: {{startDate}}\n' +
      'Pairing Date: {{interviewDate}}\n' +
      '{{pairingLinkLine}}',
    button_label: '{{ctaLabel}}',
    button_url: '{{ctaUrl}}',
    placeholders: ['{{roleType}}', '{{availability}}', '{{hrTitle}}', '{{orgName}}', '{{startDate}}', '{{interviewDate}}', '{{pairingLinkLine}}', '{{ctaLabel}}', '{{ctaUrl}}'],
  });

  // 19. hr-client-change
  // Source: notifyHireRequestClientChange in notifications.service.ts
  await fix({
    key: 'hr-client-change',
    name: 'Hire Request — Edited or Canceled by Client',
    description: 'Sent to assignees when a client edits or cancels a hire request.',
    subject: 'Hire Request {{action}}: {{hrTitle}}',
    headline: 'Hire Request {{actionUpper}}',
    body:
      'The hire request was {{action}} by the client.\n\n' +
      'Title: {{hrTitle}}\n' +
      'Organization: {{orgName}}\n' +
      'Description: {{hrDescription}}',
    button_label: 'View Hire Request Details',
    button_url: '{{hrLink}}',
    placeholders: ['{{action}}', '{{actionUpper}}', '{{hrTitle}}', '{{orgName}}', '{{hrDescription}}', '{{hrLink}}'],
  });

  // 20. hr-sourcing-assigned
  // Source: notifyHireRequestSourcingAssignee in notifications.service.ts
  await fix({
    key: 'hr-sourcing-assigned',
    name: 'Hire Request — Sourcing Assigned',
    description: 'Sent to the assigned sourcer when a hire request moves to sourcing stage.',
    subject: 'Hire Request sourcing: {{hrTitle}}',
    headline: 'Hire Request Moved to Sourcing',
    body:
      'Hi {{assigneeName}},\n\n' +
      'The hire request was updated to Start to sourcing stage.\n\n' +
      'Title: {{hrTitle}}\n' +
      'Organization: {{orgName}}\n' +
      'Description: {{hrDescription}}',
    button_label: 'View Hire Request Details',
    button_url: '{{hrLink}}',
    placeholders: ['{{assigneeName}}', '{{hrTitle}}', '{{orgName}}', '{{hrDescription}}', '{{hrLink}}'],
  });

  // 21. hr-concierge-assigned
  // Source: notifyHireRequestConciergeAssigned in notifications.service.ts
  await fix({
    key: 'hr-concierge-assigned',
    name: 'Hire Request — Ready for Review',
    description: 'Sent to assignees when a hire request is ready for concierge review.',
    subject: 'Hire Request For Review: {{hrTitle}}',
    headline: 'Hire Request Ready For Review',
    body:
      'Hi {{assigneeName}},\n\n' +
      'This request requires your attention:\n\n' +
      'Title: {{hrTitle}}\n' +
      'Organization: {{orgName}}\n' +
      'Description: {{hrDescription}}',
    button_label: 'View Hire Request Details',
    button_url: '{{hrLink}}',
    placeholders: ['{{assigneeName}}', '{{hrTitle}}', '{{orgName}}', '{{hrDescription}}', '{{hrLink}}'],
  });

  // 22. hr-created
  // Source: notifyHireRequestCreated in notifications.service.ts
  await fix({
    key: 'hr-created',
    name: 'Hire Request — Assigned to User',
    description: 'Sent when a hire request is created and assigned (to sourcing, staffing coordinator, or standard assignee).',
    subject: 'Hire Request Assigned: {{hrTitle}}',
    headline: '{{assignmentType}}',
    body:
      'Hi {{assigneeName}},\n\n' +
      'You have been assigned {{assignmentRole}} this hire request:\n\n' +
      'Title: {{hrTitle}}\n' +
      'Organization: {{orgName}}\n' +
      'Description: {{hrDescription}}\n' +
      'Availability: {{availability}}\n' +
      'Salary Range: {{salaryRange}}\n' +
      'Expected Start Date: {{startDate}}\n' +
      'Status: {{hrStatus}}\n\n' +
      'Please review the details and take appropriate action.',
    button_label: 'View Hire Request Details',
    button_url: '{{hrLink}}',
    placeholders: ['{{assigneeName}}', '{{assignmentType}}', '{{assignmentRole}}', '{{hrTitle}}', '{{orgName}}', '{{hrDescription}}', '{{availability}}', '{{salaryRange}}', '{{startDate}}', '{{hrStatus}}', '{{hrLink}}'],
  });

  // 23. hr-back-to-sourcing
  // Source: notifyHireRequestBackToSourcing in notifications.service.ts
  await fix({
    key: 'hr-back-to-sourcing',
    name: 'Hire Request — Back to Sourcing',
    description: 'Sent to the assigned sourcer when a hire request is sent back to sourcing.',
    subject: 'Hire Request Back to sourcing: {{hrTitle}}',
    headline: 'Back to Sourcing',
    body:
      'Hi {{assigneeName}},\n\n' +
      'A hire request requires your attention since it has been put back to sourcing:\n\n' +
      'Title: {{hrTitle}}\n' +
      'Organization: {{orgName}}\n' +
      'Description: {{hrDescription}}\n' +
      'Availability: {{availability}}\n' +
      'Salary Range: {{salaryRange}}\n' +
      'Expected Start Date: {{startDate}}\n' +
      'Status: {{hrStatus}}\n\n' +
      'Please review the details and take appropriate action.',
    button_label: 'View Hire Request Details',
    button_url: '{{hrLink}}',
    placeholders: ['{{assigneeName}}', '{{hrTitle}}', '{{orgName}}', '{{hrDescription}}', '{{availability}}', '{{salaryRange}}', '{{startDate}}', '{{hrStatus}}', '{{hrLink}}'],
  });

  // 24. hr-panel-ready-client
  // Source: notifyClientPanelReady in notifications.service.ts
  await fix({
    key: 'hr-panel-ready-client',
    name: 'Hire Request — Candidate Panel Ready (Client)',
    description: 'Sent to all active organization users when the candidate panel is ready for their review.',
    subject: 'Your candidate panel is ready: {{hrTitle}}',
    headline: 'Your candidate panel is ready for review!',
    body:
      'The panel for the following hire request has been reviewed and is now ready for your follow-up:\n\n' +
      'Title: {{hrTitle}}\n' +
      'Organization: {{orgName}}\n' +
      'Description: {{hrDescription}}\n' +
      'Availability: {{availability}}\n' +
      'Salary Range: {{salaryRange}}\n' +
      'Expected Start Date: {{startDate}}\n\n' +
      'Please review the details and candidates within this panel.',
    button_label: 'View Candidates',
    button_url: '{{hrLink}}',
    placeholders: ['{{hrTitle}}', '{{orgName}}', '{{hrDescription}}', '{{availability}}', '{{salaryRange}}', '{{startDate}}', '{{hrLink}}'],
  });

  // 25. hr-panel-ready-internal
  // Source: notifyHireRequestPanelReady in notifications.service.ts
  await fix({
    key: 'hr-panel-ready-internal',
    name: 'Hire Request — Panel Reviewed and Ready (Internal)',
    description: 'Sent to the assigned sourcer when the panel has been reviewed and is ready.',
    subject: 'Panel Reviewed and Ready: {{hrTitle}}',
    headline: 'Panel Ready',
    body:
      'Hi {{assigneeName}},\n\n' +
      'The panel of the following hire request has been reviewed and now it is ready:\n\n' +
      'Title: {{hrTitle}}\n' +
      'Organization: {{orgName}}\n' +
      'Description: {{hrDescription}}\n' +
      'Availability: {{availability}}\n' +
      'Salary Range: {{salaryRange}}\n' +
      'Expected Start Date: {{startDate}}\n' +
      'Status: {{hrStatus}}\n\n' +
      'Please review the details and take appropriate action.',
    button_label: 'View Hire Request Details',
    button_url: '{{hrLink}}',
    placeholders: ['{{assigneeName}}', '{{hrTitle}}', '{{orgName}}', '{{hrDescription}}', '{{availability}}', '{{salaryRange}}', '{{startDate}}', '{{hrStatus}}', '{{hrLink}}'],
  });

  // 26. hr-candidates-endorsed
  // Source: notifyEndorseCandidates in notifications.service.ts
  await fix({
    key: 'hr-candidates-endorsed',
    name: 'Hire Request — New Candidates Endorsed',
    description: 'Sent to assignees when new candidates are added to a hire request.',
    subject: 'New candidates in Hire Request: {{hrTitle}}',
    headline: 'New Candidates in Hire Request',
    body:
      'Hi {{assigneeName}},\n\n' +
      'The hire request received new candidates.\n\n' +
      'Title: {{hrTitle}}\n' +
      'Organization: {{orgName}}\n' +
      'Description: {{hrDescription}}',
    button_label: 'View Hire Request Details',
    button_url: '{{hrLink}}',
    placeholders: ['{{assigneeName}}', '{{hrTitle}}', '{{orgName}}', '{{hrDescription}}', '{{hrLink}}'],
  });

  // 27. hr-winner-selected
  // Source: notifyHireRequestSelectWinner in notifications.service.ts
  await fix({
    key: 'hr-winner-selected',
    name: 'Hire Request — Completed (Winner Selected)',
    description: 'Sent to organization admins when a candidate is selected and the hire request is completed.',
    subject: 'Hire Request Completed: {{roleType}} - {{availability}}.',
    headline: 'Hire Request Completed',
    body:
      'Your hire request has been completed.\n\n' +
      'Title: {{hrTitle}}\n' +
      'Organization: {{orgName}}\n' +
      'Description: {{hrDescription}}\n' +
      'Salary Range: {{salaryRange}}\n' +
      'Expected Start Date: {{startDate}}\n' +
      'Selected Candidate: {{winnerName}}\n\n' +
      'Please review the details and proceed with the next steps.',
    button_label: 'Review Hire Request',
    button_url: '{{hrLink}}',
    placeholders: ['{{roleType}}', '{{availability}}', '{{hrTitle}}', '{{orgName}}', '{{hrDescription}}', '{{salaryRange}}', '{{startDate}}', '{{winnerName}}', '{{hrLink}}'],
  });

  // 28. hr-awaiting-decision
  // Source: notifyHireRequestAwaitingDecision in notifications.service.ts
  await fix({
    key: 'hr-awaiting-decision',
    name: 'Hire Request — Awaiting Decision',
    description: 'Sent to organization admins when a hire request is marked as awaiting decision.',
    subject: 'Your hire request has been marked as awaiting decision: {{roleType}} - {{availability}}',
    headline: 'Hire Request Awaiting Decision',
    body:
      'Your hire request has been marked as awaiting decision.\n\n' +
      'Scheduled Date: {{scheduledDate}}\n\n' +
      'Please review and make your decision.',
    button_label: 'Review Hire Request',
    button_url: '{{hrLink}}',
    placeholders: ['{{roleType}}', '{{availability}}', '{{scheduledDate}}', '{{hrLink}}'],
  });

  // ── TICKET templates ────────────────────────────────────────────────────────

  // 29. ticket-status-changed
  // Source: notifyTicketStatusChangeToCreator in notifications.service.ts
  await fix({
    key: 'ticket-status-changed',
    name: 'Ticket — Status Changed',
    description: 'Sent to the ticket creator when the ticket status changes.',
    subject: 'Your ticket changed to {{status}} status: {{ticketTitle}}',
    headline: 'Ticket Status Updated',
    body:
      'Your ticket has been updated to {{status}} status.\n\n' +
      'Title: {{ticketTitle}}\n' +
      'Organization: {{orgName}}\n' +
      'Type: {{ticketType}}\n' +
      'Status: {{status}}\n' +
      'Created: {{createdDate}}\n\n' +
      'Description:\n{{ticketDescription}}',
    button_label: 'View Ticket Details',
    button_url: '{{ticketLink}}',
    placeholders: ['{{status}}', '{{ticketTitle}}', '{{orgName}}', '{{ticketType}}', '{{createdDate}}', '{{ticketDescription}}', '{{ticketLink}}'],
  });

  // 30. ticket-reopened
  // Source: notifyTicketReopened in notifications.service.ts
  await fix({
    key: 'ticket-reopened',
    name: 'Ticket — Reopened',
    description: 'Sent to the ticket creator when a ticket is reopened.',
    subject: 'Your ticket has been reopened: {{ticketTitle}}',
    headline: 'Ticket Reopened',
    body:
      'Your ticket has been reopened.\n\n' +
      'Title: {{ticketTitle}}\n' +
      'Organization: {{orgName}}\n' +
      'Type: {{ticketType}}\n' +
      'Created: {{createdDate}}\n\n' +
      'Description:\n{{ticketDescription}}',
    button_label: 'View Ticket Details',
    button_url: '{{ticketLink}}',
    placeholders: ['{{ticketTitle}}', '{{orgName}}', '{{ticketType}}', '{{createdDate}}', '{{ticketDescription}}', '{{ticketLink}}'],
  });

  // 31. ticket-event
  // Source: notifyTicketEvent in notifications.service.ts
  await fix({
    key: 'ticket-event',
    name: 'Ticket — Event Notification',
    description: 'Sent when a ticket event occurs (created, assigned, updated, resolved, closed).',
    subject: 'Ticket {{event}}: {{ticketTitle}}',
    headline: 'Ticket {{event}}',
    body:
      'A ticket has been {{event}}.\n\n' +
      'Title: {{ticketTitle}}\n' +
      'Organization: {{orgName}}\n' +
      'Type: {{ticketType}}\n' +
      'Description:\n{{ticketDescription}}',
    button_label: 'View Ticket Details',
    button_url: '{{ticketLink}}',
    placeholders: ['{{event}}', '{{ticketTitle}}', '{{orgName}}', '{{ticketType}}', '{{ticketDescription}}', '{{ticketLink}}'],
  });

  // 32. ticket-note-added
  // Source: notifyTicketNoteAddedToAssignee + notifyTicketNoteAddedToCreator
  await fix({
    key: 'ticket-note-added',
    name: 'Ticket — New Response / Note Added',
    description: 'Sent to the ticket assignee or creator when a new note/response is added.',
    subject: 'You received a response on your ticket: {{ticketTitle}}',
    headline: 'New Response on Your Ticket',
    body:
      'You received a new response on your ticket.\n\n' +
      'Ticket: {{ticketTitle}}\n' +
      'Organization: {{orgName}}\n' +
      'Response from: {{authorName}}\n\n' +
      '{{noteContent}}',
    button_label: 'View Ticket Details',
    button_url: '{{ticketLink}}',
    placeholders: ['{{ticketTitle}}', '{{orgName}}', '{{authorName}}', '{{noteContent}}', '{{ticketLink}}'],
  });

  // ── OFFER PANEL templates ───────────────────────────────────────────────────

  // 33. offer-panel-created
  // Source: notifyOfferPanelCreatedClient + notifyOfferPanelCreatedPublic
  await fix({
    key: 'offer-panel-created',
    name: 'Offer Panel — Candidates Selected for You',
    description: 'Sent to the client when candidates are pre-selected in an offer panel.',
    subject: '{{candidateLabel}} picked for you — {{companyName}}',
    headline: 'Candidates selected for you',
    body:
      'Hi,\n\n' +
      '{{createdByName}} from {{companyName}} has handpicked {{candidateCount}} candidate(s) specifically for you.\n\n' +
      'Review them at your convenience and let us know your thoughts.',
    button_label: 'View Candidates',
    button_url: '{{panelLink}}',
    placeholders: ['{{candidateLabel}}', '{{companyName}}', '{{createdByName}}', '{{candidateCount}}', '{{panelLink}}'],
  });

  // 34. offer-panel-accepted
  // Source: notifyAdminOfferPanelAccepted in notifications.service.ts
  await fix({
    key: 'offer-panel-accepted',
    name: 'Offer Panel — Accepted by Client',
    description: 'Sent to the panel creator when the client accepts the offer panel.',
    subject: 'Your offer was accepted',
    headline: 'Offer Panel Accepted',
    body:
      'Great news! Your offer panel has been accepted.\n\n' +
      'Recipient: {{recipientName}}\n' +
      'Organization: {{recipientOrg}}\n' +
      'Email: {{recipientEmail}}\n' +
      'Panel Title: {{panelTitle}}',
    button_label: null,
    button_url: null,
    placeholders: ['{{recipientName}}', '{{recipientOrg}}', '{{recipientEmail}}', '{{panelTitle}}'],
  });

  // 35. offer-panel-declined
  // Source: notifyAdminOfferPanelDeclined in notifications.service.ts
  await fix({
    key: 'offer-panel-declined',
    name: 'Offer Panel — Declined by Client',
    description: 'Sent to the panel creator when the client declines the offer panel.',
    subject: 'Your offer was declined',
    headline: 'Offer Panel Declined',
    body:
      'Your offer panel has been declined.\n\n' +
      'Recipient: {{recipientName}}\n' +
      'Organization: {{recipientOrg}}\n' +
      'Email: {{recipientEmail}}\n' +
      'Panel Title: {{panelTitle}}',
    button_label: null,
    button_url: null,
    placeholders: ['{{recipientName}}', '{{recipientOrg}}', '{{recipientEmail}}', '{{panelTitle}}'],
  });

  // ── TALENT POOL template ────────────────────────────────────────────────────

  // 36. talent-pool-lead-new
  // Source: notifyTalentPoolLeadNew in notifications.service.ts
  await fix({
    key: 'talent-pool-lead-new',
    name: 'Talent Pool — New Lead',
    description: 'Sent to the owner when a new lead is submitted via the talent pool.',
    subject: 'New talent pool lead: {{leadName}} — {{organization}}',
    headline: 'New Talent Pool Lead',
    body:
      'A new lead has been submitted via the talent pool.\n\n' +
      'Name: {{leadName}}\n' +
      'Email: {{leadEmail}}\n' +
      'Organization: {{organization}}\n' +
      'Website: {{websiteUrl}}\n' +
      'Language Preference: {{languagePreference}}\n' +
      'Main Need: {{mainNeed}}\n' +
      'Additional Details: {{additionalDetails}}',
    button_label: null,
    button_url: null,
    placeholders: ['{{leadName}}', '{{leadEmail}}', '{{organization}}', '{{websiteUrl}}', '{{languagePreference}}', '{{mainNeed}}', '{{additionalDetails}}'],
  });

  console.log('\n✅ All 20 HR/Tickets templates added.');
  console.log('\n🔧 Adding 14 Med Alliance templates...\n');

  // ── MED ALLIANCE — Affiliate (partner-facing) templates ────────────────────

  // 37. alliance-commission-eligible
  // Source: /src/med-alliance/notifications/templates/commission-eligible.ts
  await fix({
    key: 'alliance-commission-eligible',
    name: 'Med Alliance — Commission Eligible',
    description: 'Sent to the affiliate when a commission becomes eligible for payout.',
    subject: 'Your commission is ready — ${{commissionAmount}} from {{organizationName}}',
    headline: "Great news! Your commission is now eligible for payout.",
    body:
      'Hi {{firstName}},\n\n' +
      'Your commission from {{organizationName}} is now eligible for payout. This means you can request a transfer to your account whenever you\'re ready.\n\n' +
      'Commission amount: ${{commissionAmount}}\n' +
      'Commission rate: {{commissionPercent}}% from {{organizationName}}\n\n' +
      'Head to your earnings dashboard to request your payout — it only takes a moment.',
    button_label: 'View My Earnings',
    button_url: '{{earningsUrl}}',
    placeholders: ['{{firstName}}', '{{organizationName}}', '{{commissionAmount}}', '{{commissionPercent}}', '{{earningsUrl}}'],
  });

  // 38. alliance-payout-cancelled
  // Source: /src/med-alliance/notifications/templates/payout-cancelled.ts
  await fix({
    key: 'alliance-payout-cancelled',
    name: 'Med Alliance — Payout Cancelled',
    description: 'Sent to the affiliate when their payout request is cancelled.',
    subject: 'Update on your payout request of ${{totalAmount}}',
    headline: 'Your payout request has been cancelled.',
    body:
      'Hi {{firstName}},\n\n' +
      'We wanted to let you know that your recent payout request has been cancelled by our team.\n\n' +
      'Cancelled payout amount: ${{totalAmount}}\n\n' +
      '{{cancellationReason}}\n\n' +
      'The good news: all commissions from this request have been returned to your available balance. You can submit a new payout request for them at any time from your dashboard.',
    button_label: 'View My Payouts',
    button_url: '{{payoutsUrl}}',
    placeholders: ['{{firstName}}', '{{totalAmount}}', '{{cancellationReason}}', '{{payoutsUrl}}'],
  });

  // 39. alliance-payout-processing
  // Source: /src/med-alliance/notifications/templates/payout-processing.ts
  await fix({
    key: 'alliance-payout-processing',
    name: 'Med Alliance — Payout Processing',
    description: 'Sent to the affiliate when their payout is being processed.',
    subject: 'Your payout of ${{totalAmount}} is being processed',
    headline: "We've received your payout request and it's currently being processed.",
    body:
      'Hi {{firstName}},\n\n' +
      "We've received your payout request and it's currently being processed. You'll receive a confirmation once the payment is on its way.\n\n" +
      'Amount: ${{totalAmount}}\n' +
      'Submitted on: {{processedDate}}\n\n' +
      'In the meantime, you can track the status of all your payouts in your partner dashboard.',
    button_label: 'View My Payouts',
    button_url: '{{payoutsUrl}}',
    placeholders: ['{{firstName}}', '{{totalAmount}}', '{{processedDate}}', '{{payoutsUrl}}'],
  });

  // 40. alliance-payout-paid
  // Source: /src/med-alliance/notifications/templates/payout-paid.ts
  await fix({
    key: 'alliance-payout-paid',
    name: 'Med Alliance — Payout Sent',
    description: "Sent to the affiliate when their payout has been sent.",
    subject: 'Your payout of ${{totalAmount}} has been sent — money is on its way!',
    headline: 'Your payout has been sent!',
    body:
      'Hi {{firstName}},\n\n' +
      "The funds are on their way and should arrive according to your payout method's typical timeline.\n\n" +
      'Amount sent: ${{totalAmount}}\n' +
      'Sent on: {{paidDate}}\n\n' +
      'You can view this payment and your full payout history in your partner dashboard.',
    button_label: 'View My Payouts',
    button_url: '{{payoutsUrl}}',
    placeholders: ['{{firstName}}', '{{totalAmount}}', '{{paidDate}}', '{{payoutsUrl}}'],
  });

  // 41. alliance-referral-stage-changed
  // Source: /src/med-alliance/notifications/templates/referral-stage-changed.ts
  await fix({
    key: 'alliance-referral-stage-changed',
    name: 'Med Alliance — Referral Stage Changed',
    description: 'Sent to the affiliate when a referred company moves to a new pipeline stage.',
    subject: 'Pipeline update: {{organizationName}} is now at "{{newStage}}"',
    headline: '{{organizationName}} has moved to a new stage',
    body:
      'Hi {{firstName}},\n\n' +
      'Good news — {{organizationName}} has progressed to a new stage in the Med Alliance pipeline!\n\n' +
      'Previous stage: {{previousStage}}\n' +
      'New stage: {{newStage}}\n\n' +
      'Log in to your partner dashboard to see the full status of all your referred companies and track their progress toward deployment.',
    button_label: 'View My Referrals',
    button_url: '{{referralsUrl}}',
    placeholders: ['{{firstName}}', '{{organizationName}}', '{{previousStage}}', '{{newStage}}', '{{referralsUrl}}'],
  });

  // ── MED ALLIANCE — Admin (internal) templates ──────────────────────────────

  // 42. alliance-admin-payout-requested
  // Source: /src/med-alliance/notifications/templates/admin-payout-requested.ts
  await fix({
    key: 'alliance-admin-payout-requested',
    name: 'Med Alliance — Admin: New Payout Request',
    description: 'Sent to admins when an affiliate submits a payout request.',
    subject: 'Payout request from {{affiliateName}} — ${{totalAmount}}',
    headline: 'A partner has submitted a new payout request that requires your review.',
    body:
      'Partner: {{affiliateName}}\n' +
      'Total Amount: ${{totalAmount}}\n' +
      'Commissions Included: {{commissionCount}}\n' +
      'Request ID: {{payoutRequestId}}',
    button_label: 'Review Payout Requests',
    button_url: '{{payoutRequestsUrl}}',
    placeholders: ['{{affiliateName}}', '{{totalAmount}}', '{{commissionCount}}', '{{payoutRequestId}}', '{{payoutRequestsUrl}}'],
  });

  // 43. alliance-admin-commission-pending
  // Source: /src/med-alliance/notifications/templates/admin-commission-pending.ts
  await fix({
    key: 'alliance-admin-commission-pending',
    name: 'Med Alliance — Admin: Commission Pending Review',
    description: "Sent to admins when a commission is ready for review.",
    subject: 'Commission ready for review — {{organizationName}}',
    headline: "A new commission is ready for your review. Please approve or reject it to keep the partner's earnings up to date.",
    body:
      'Organization: {{organizationName}}\n' +
      'Affiliate: {{affiliateName}}\n' +
      'Commission Amount: ${{commissionAmount}}\n' +
      'Commission ID: {{commissionId}}',
    button_label: 'Review Commissions',
    button_url: '{{commissionsUrl}}',
    placeholders: ['{{organizationName}}', '{{affiliateName}}', '{{commissionAmount}}', '{{commissionId}}', '{{commissionsUrl}}'],
  });

  // 44. alliance-admin-commission-reverted
  // Source: /src/med-alliance/notifications/templates/admin-commission-reverted.ts
  await fix({
    key: 'alliance-admin-commission-reverted',
    name: 'Med Alliance — Admin: Commission Reverted to Pending',
    description: 'Sent to admins when a commission is reverted back to pending status.',
    subject: 'Commission reverted to Pending — {{organizationName}}',
    headline: 'An admin has reverted a commission back to pending review. Please check the details below and take action.',
    body:
      'Organization: {{organizationName}}\n' +
      'Affiliate: {{affiliateName}}\n' +
      'Commission Amount: ${{commissionAmount}}\n' +
      'Commission ID: {{commissionId}}\n' +
      'Reverted by: {{revertedByName}}',
    button_label: 'Review Commissions',
    button_url: '{{commissionsUrl}}',
    placeholders: ['{{organizationName}}', '{{affiliateName}}', '{{commissionAmount}}', '{{commissionId}}', '{{revertedByName}}', '{{commissionsUrl}}'],
  });

  // 45. alliance-admin-referral-new
  // Source: /src/med-alliance/notifications/templates/admin-referral-new.ts
  await fix({
    key: 'alliance-admin-referral-new',
    name: 'Med Alliance — Admin: New Referral',
    description: 'Sent to admins when a new company is referred through the Med Alliance program.',
    subject: 'New referral: {{organizationName}}',
    headline: 'A new company has been referred through the Med Alliance program.',
    body:
      'Company: {{organizationName}}\n' +
      'Referred by / Performed by: {{affiliateName}}\n' +
      'Company ID: {{referredCompanyId}}',
    button_label: 'View Pipeline',
    button_url: '{{pipelineUrl}}',
    placeholders: ['{{organizationName}}', '{{affiliateName}}', '{{referredCompanyId}}', '{{pipelineUrl}}'],
  });

  // 46. alliance-admin-partner-registered
  // Source: /src/med-alliance/notifications/templates/admin-partner-registered.ts
  await fix({
    key: 'alliance-admin-partner-registered',
    name: 'Med Alliance — Admin: New Partner Registered',
    description: 'Sent to admins when a new Growth Partner joins the Med Alliance program.',
    subject: 'New Alliance partner registered: {{partnerName}}',
    headline: 'A new Growth Partner has joined the Med Alliance program.',
    body:
      'Name: {{partnerName}}\n' +
      'Email: {{partnerEmail}}\n' +
      'Profile ID: {{affiliateProfileId}}',
    button_label: 'View Partners',
    button_url: '{{partnersUrl}}',
    placeholders: ['{{partnerName}}', '{{partnerEmail}}', '{{affiliateProfileId}}', '{{partnersUrl}}'],
  });

  // 47. alliance-admin-commission-summary
  // Source: /src/med-alliance/notifications/templates/admin-commission-pending-summary.ts
  await fix({
    key: 'alliance-admin-commission-summary',
    name: 'Med Alliance — Admin: Daily Commission Review Summary',
    description: 'Daily summary sent to admins with all pending commissions.',
    subject: 'Daily commission review — {{commissionCount}} pending (${{totalAmount}})',
    headline: '{{commissionCount}} commission(s) are pending your review as of {{reportDate}}.',
    body:
      'Total pending: ${{totalAmount}}\n\n' +
      'Commissions pending review:\n{{commissionsTable}}',
    button_label: 'Review Commissions',
    button_url: '{{commissionsUrl}}',
    placeholders: ['{{commissionCount}}', '{{totalAmount}}', '{{reportDate}}', '{{commissionsTable}}', '{{commissionsUrl}}'],
  });

  // 48. alliance-admin-mark-paid-error
  // Source: /src/med-alliance/notifications/templates/admin-markpaid-error.ts
  await fix({
    key: 'alliance-admin-mark-paid-error',
    name: 'Med Alliance — Admin: markPaid() Error',
    description: 'Sent to admins when markPaid() fails during payout processing.',
    subject: 'markPaid() error at "{{errorPhase}}" — payout {{payoutRequestId}}',
    headline: 'Action required: markPaid() failed at phase "{{errorPhase}}"',
    body:
      'An error occurred while processing a payout via markPaid(). The payout was not completed.\n\n' +
      'Payout Request ID: {{payoutRequestId}}\n' +
      'Triggered by: {{adminName}}\n' +
      'Failed at phase: {{errorPhase}}\n' +
      'Affiliate: {{affiliateName}}\n' +
      'Amount: ${{amount}}\n' +
      'Error: {{errorMessage}}',
    button_label: 'View Payout Request',
    button_url: '{{payoutRequestUrl}}',
    placeholders: ['{{errorPhase}}', '{{payoutRequestId}}', '{{adminName}}', '{{affiliateName}}', '{{amount}}', '{{errorMessage}}', '{{payoutRequestUrl}}'],
  });

  // 49. alliance-admin-payment-failed
  // Source: /src/med-alliance/notifications/templates/admin-payment-failed.ts
  await fix({
    key: 'alliance-admin-payment-failed',
    name: 'Med Alliance — Admin: Bill.com Payment Failed',
    description: 'Sent to admins when a Bill.com payment fails.',
    subject: 'Bill.com payment failed — {{partnerName}} (${{amount}})',
    headline: 'Action required: a Bill.com payment has failed',
    body:
      'A payout payment failed and requires your immediate attention.\n\n' +
      'Partner: {{partnerName}}\n' +
      'Amount: ${{amount}}\n' +
      'Bill.com Payment ID: {{billIds}}\n' +
      'Payout Request ID: {{payoutRequestId}}\n' +
      'Error: {{errorMsg}}',
    button_label: 'Review Payout Requests',
    button_url: '{{payoutRequestsUrl}}',
    placeholders: ['{{partnerName}}', '{{amount}}', '{{billIds}}', '{{payoutRequestId}}', '{{errorMsg}}', '{{payoutRequestsUrl}}'],
  });

  // 50. alliance-admin-remember-me-expired
  // Source: /src/med-alliance/notifications/templates/admin-remember-me-expired.ts
  await fix({
    key: 'alliance-admin-remember-me-expired',
    name: 'Med Alliance — Admin: Bill.com Session Expired',
    description: 'Sent to admins when the Bill.com rememberMeId expires and needs renewal.',
    subject: 'Bill.com rememberMeId expired',
    headline: 'Alert: Bill.com rememberMeId has expired (BDC_1109)',
    body:
      'The Bill.com rememberMeId stored in the database has expired. All payment initiations are failing because the API session cannot be established with MFA trust.\n\n' +
      'Steps to resolve:\n' +
      '1. Call POST /v3/mfa/challenge to trigger an SMS token\n' +
      '2. Call POST /v3/mfa/challenge/validate with the challengeId\n' +
      '3. Update the BillComCredential record in the database with the new rememberMeId\n\n' +
      'Note: The rememberMeId is valid for 180 days from the date of issue.',
    button_label: null,
    button_url: null,
    placeholders: [],
  });

  console.log('\n✅ All 14 Med Alliance templates added.\n');

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
