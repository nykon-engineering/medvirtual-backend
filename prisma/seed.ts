import { PrismaClient } from '@prisma/client';

const FLOOR_PRICE_HOURS_PER_MONTH = 176;

const floorPriceEnglish: Record<string, number> = {
  'Junior Medical Admin': 1800,
  'Junior Dental Admin': 1800,
  'Senior Medical Admin': 2200,
  'Senior Dental Admin': 2200,
  'Medical Nurse': 2820,
  'Medical Doctor (MD)': 2820,
  'Dental Nurse': 2820,
  'Dental Doctor (Dentist)': 2820,
  'Junior Medical Biller': 1800,
  'Junior Dental Biller': 1800,
  'Senior Medical Biller': 2200,
  'Senior Dental Biller': 2200,
  'Full Cycle Medical Biller': 2400,
  'Full Cycle Dental Biller': 2400,
  'Junior Med-Legal Case Coordinator': 2400,
  'Senior Med-Legal Case Coordinator': 2820,
  'Sales Development Representative (SDR)': 1800,
  'Sales Executive': 2200,
  'Sales and Account Manager': 2820,
  'Bookkeeper': 2400,
  'Marketing Assistant': 2990,
};

const floorPriceBilingual: Record<string, number> = {
  'Junior Medical Admin': 2000,
  'Junior Dental Admin': 2000,
  'Senior Medical Admin': 2400,
  'Senior Dental Admin': 2400,
  'Medical Nurse': 2990,
  'Medical Doctor (MD)': 2990,
  'Dental Nurse': 2990,
  'Dental Doctor (Dentist)': 2990,
  'Junior Medical Biller': 2000,
  'Junior Dental Biller': 2000,
  'Senior Medical Biller': 2400,
  'Senior Dental Biller': 2400,
  'Full Cycle Medical Biller': 2640,
  'Full Cycle Dental Biller': 2640,
  'Junior Med-Legal Case Coordinator': 2640,
  'Senior Med-Legal Case Coordinator': 2990,
  'Sales Development Representative (SDR)': 2000,
  'Sales Executive': 2400,
  'Sales and Account Manager': 2990,
  'Bookkeeper': 2640,
  'Marketing Assistant': 3240,
};

const prisma = new PrismaClient();

async function main() {
  // Seed PositionRateConfig from dictionaries
  const allPositions = new Set([
    ...Object.keys(floorPriceEnglish),
    ...Object.keys(floorPriceBilingual),
  ]);

  for (const position of allPositions) {
    const floorPriceEnglishHourly =
      floorPriceEnglish[position] !== undefined
        ? floorPriceEnglish[position] / FLOOR_PRICE_HOURS_PER_MONTH
        : null;
    const floorPriceBilingualHourly =
      floorPriceBilingual[position] !== undefined
        ? floorPriceBilingual[position] / FLOOR_PRICE_HOURS_PER_MONTH
        : null;
    await prisma.positionRateConfig.upsert({
      where: { position },
      update: {},
      create: {
        position,
        medVirtual_floor_price_english: floorPriceEnglishHourly,
        berryVirtual_floor_price_english: floorPriceEnglishHourly,
        medVirtual_floor_price_bilingual: floorPriceBilingualHourly,
        berryVirtual_floor_price_bilingual: floorPriceBilingualHourly,
        medVirtual_margin_per_hour: 9,
        berryVirtual_margin_per_hour: 9,
      },
    });
  }

  console.log(`💰 PositionRateConfig seeded: ${allPositions.size} positions`);

  console.log('✅ PositionRateConfig seeding completed successfully!');
  console.log(`- Position rate configs: ${await prisma.positionRateConfig.count()}`);

  // ─── Business Units ──────────────────────────────────────────────────────────
  const businessUnits = [
    { slug: 'medvirtual', name: 'MedVirtual' },
    { slug: 'berry-virtual', name: 'Berry Virtual' },
  ];

  for (const bu of businessUnits) {
    await prisma.businessUnit.upsert({
      where: { slug: bu.slug },
      update: {},
      create: { slug: bu.slug, name: bu.name },
    });
  }

  console.log(`🏢 BusinessUnits seeded: ${businessUnits.length}`);

  // ─── Email Branding ───────────────────────────────────────────────────────────
  const brandings = [
    {
      business_unit: 'medvirtual',
      primary_color: '#01546B',
      secondary_color: '#013A4F',
      logo_url: 'https://staging.medvirtual.ai/logo.png',
      company_name: 'MedVirtual',
      layout_preset: 'default',
    },
    {
      business_unit: 'berry-virtual',
      primary_color: '#FD7171',
      secondary_color: '#E55A5A',
      logo_url: 'https://staging.medvirtual.ai/logobv.png',
      company_name: 'Berry Virtual',
      layout_preset: 'default',
    },
  ];

  for (const branding of brandings) {
    await prisma.emailBranding.upsert({
      where: { business_unit: branding.business_unit },
      update: {},
      create: branding,
    });
  }

  console.log(`🎨 EmailBranding seeded: ${brandings.length}`);

  // ─── Email Templates ─────────────────────────────────────────────────────────
  // business_unit: null = template global (applies to all BUs)
  const emailTemplates = [
    {
      key: 'invite-signup',
      name: 'User Invitation',
      description: 'Sent when a user is invited to the platform.',
      subject: 'You have been invited to the {{companyName}} platform',
      headline: 'Welcome to {{companyName}}!',
      body: "Hi,\n\nYou have been invited to join the MedVirtual platform. Please click the button below to easily and securely activate your account.\n\nOnce activated, you can manage your hired staff, submit new hire requests, and explore our candidate pool to source the right support for your team.\n\n⏰ Important: This invitation will expire in 48 hours for security reasons.",
      button_label: 'Activate My Account',
      button_url: '{{inviteLink}}',
      placeholders: ['{{inviteLink}}', '{{companyName}}'],
    },
    {
      key: 'reset-password',
      name: 'Password Reset',
      description: 'Sent when a user requests a password reset.',
      subject: 'Reset your {{companyName}} password',
      headline: 'Reset your password',
      body: "Hi {{userName}},\n\nWe received a request to reset your password for your {{companyName}} account. Just click the button below to easily and securely create a new password :)\n\n⏰ Important: This password reset link will expire in 10 minutes for security reasons.\n\nIf you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.",
      button_label: 'Reset My Password',
      button_url: '{{resetLink}}',
      placeholders: ['{{userName}}', '{{resetLink}}', '{{companyName}}'],
    },
    {
      key: 'verification-code',
      name: 'Email Verification Code',
      description: 'Sent with the OTP code during account sign-up.',
      subject: 'Verify your {{companyName}} account',
      headline: 'Your verification code',
      body: "Hi,\n\nHere is your verification code. Just enter the code below to easily and securely verify your account :)\n\nYour code: {{verificationCode}}\n\n⏰ Important: This code will expire in 10 minutes for security reasons.",
      button_label: 'Verify Account',
      button_url: '{{verificationUrl}}',
      placeholders: ['{{verificationCode}}', '{{verificationUrl}}', '{{companyName}}'],
    },
    {
      key: 'schedule-interview',
      name: 'Schedule Interview',
      description: 'Sent to invite a candidate to schedule an interview.',
      subject: 'You have been invited to join our healthcare platform',
      headline: 'Join our platform',
      body: "Hi,\n\nYou have been invited to join our healthcare platform. Just click the button below to easily and securely create your account :)\n\n⏰ Important: This invitation will expire in 48 hours for security reasons.",
      button_label: 'Activate My Account',
      button_url: '{{inviteLink}}',
      placeholders: ['{{inviteLink}}', '{{companyName}}'],
    },
    {
      key: 'med-alliance-invite-signup',
      name: 'Med Alliance — Affiliate Invitation',
      description: 'Sent to invite a new affiliate to the Med Alliance program.',
      subject: 'You have been invited to join the {{companyName}} affiliate program',
      headline: 'Join the {{companyName}} Affiliate Program',
      body: "Hi,\n\nYou have been invited to join the {{companyName}} affiliate program. Click the button below to activate your affiliate account and start earning commissions.",
      button_label: 'Activate Affiliate Account',
      button_url: '{{inviteLink}}',
      placeholders: ['{{inviteLink}}', '{{companyName}}'],
    },
    {
      key: 'med-alliance-invitation',
      name: 'Med Alliance — Partner Invitation',
      description: 'Sent to invite a company to become a Med Alliance partner.',
      subject: 'Partnership invitation from {{companyName}}',
      headline: 'You are invited to partner with {{companyName}}',
      body: "Hi,\n\nYou have been invited to become a partner of {{companyName}}. Click the button below to learn more and accept the invitation.",
      button_label: 'View Invitation',
      button_url: '{{inviteLink}}',
      placeholders: ['{{inviteLink}}', '{{companyName}}', '{{partnerName}}'],
    },
    {
      key: 'med-alliance-org-invitation',
      name: 'Med Alliance — Organization User Invitation',
      description: 'Sent to invite organization users to the Med Alliance program.',
      subject: 'Join the {{companyName}} affiliate program',
      headline: 'Affiliate Program Invitation',
      body: "Hi {{userName}},\n\nYour organization has been enrolled in the {{companyName}} affiliate program. Click the button below to activate your account and start referring companies.",
      button_label: 'Activate My Account',
      button_url: '{{inviteLink}}',
      placeholders: ['{{inviteLink}}', '{{userName}}', '{{companyName}}', '{{organizationName}}'],
    },
    {
      key: 'new-positions-alert',
      name: 'New Positions Alert',
      description: 'Sent to notify affiliates of new open positions.',
      subject: 'New positions available on {{companyName}}',
      headline: '{{positionCount}} new position(s) available',
      body: "Hi {{userName}},\n\nThere are {{positionCount}} new position(s) available on the {{companyName}} platform that match your network. Log in to view and refer candidates.",
      button_label: 'View Positions',
      button_url: '{{platformUrl}}',
      placeholders: ['{{userName}}', '{{positionCount}}', '{{platformUrl}}', '{{companyName}}'],
    },
    {
      key: 'quarterly-payout-report',
      name: 'Quarterly Payout Report',
      description: 'Sent to affiliates with their quarterly earnings summary.',
      subject: 'Your {{companyName}} quarterly payout report',
      headline: 'Quarterly Payout Summary',
      body: "Hi {{userName}},\n\nHere is your quarterly payout report for {{quarter}} {{year}}.\n\nTotal earnings: {{totalEarnings}}\nPaid out: {{paidOut}}\nPending: {{pendingAmount}}\n\nLog in to view the full breakdown.",
      button_label: 'View Report',
      button_url: '{{reportUrl}}',
      placeholders: ['{{userName}}', '{{quarter}}', '{{year}}', '{{totalEarnings}}', '{{paidOut}}', '{{pendingAmount}}', '{{reportUrl}}', '{{companyName}}'],
    },
    {
      key: 'client-users-deactivation',
      name: 'Client Users Deactivation Report',
      description: 'Sent to admins reporting deactivated client users.',
      subject: '[Report] Client users deactivation — {{date}}',
      headline: 'Client Users Deactivation Report',
      body: "Hi,\n\nThe following client users have been deactivated on {{date}}:\n\n{{userList}}\n\nThis is an automated report.",
      button_label: null,
      button_url: null,
      placeholders: ['{{date}}', '{{userList}}'],
    },
    {
      key: 'med-alliance-deployed-companies',
      name: 'Med Alliance — Deployed Companies Report',
      description: 'Sent to admins with a report of deployed companies via Med Alliance.',
      subject: '[Report] Med Alliance deployed companies — {{date}}',
      headline: 'Med Alliance Deployed Companies',
      body: "Hi,\n\nHere is the Med Alliance deployed companies report for {{date}}:\n\n{{companiesList}}\n\nThis is an automated report.",
      button_label: null,
      button_url: null,
      placeholders: ['{{date}}', '{{companiesList}}'],
    },
    {
      key: 'system-report',
      name: 'System Report',
      description: 'Daily automated system report sent to system admins.',
      subject: '[System Report] {{companyName}} — {{date}}',
      headline: 'Daily System Report',
      body: "Hi,\n\nHere is the daily system report for {{date}}.\n\n{{reportContent}}\n\nThis is an automated report.",
      button_label: null,
      button_url: null,
      placeholders: ['{{date}}', '{{reportContent}}', '{{companyName}}'],
    },
    {
      key: 'cron-job-error',
      name: 'Cron Job Error Report',
      description: 'Sent to system admins when a cron job fails.',
      subject: '[ERROR] Cron job failed — {{jobName}}',
      headline: 'Cron Job Failure Alert',
      body: "A cron job has failed.\n\nJob: {{jobName}}\nTime: {{errorTime}}\nError: {{errorMessage}}\n\nPlease investigate immediately.",
      button_label: null,
      button_url: null,
      placeholders: ['{{jobName}}', '{{errorTime}}', '{{errorMessage}}'],
    },
    {
      key: 'google-token-expired',
      name: 'Google Token Expired',
      description: 'Sent to admins when a Google OAuth token expires.',
      subject: '[Alert] Google token expired',
      headline: 'Google Token Expired',
      body: "The Google OAuth token has expired and needs to be renewed. Please re-authenticate the Google integration to restore functionality.\n\nAffected account: {{accountEmail}}",
      button_label: null,
      button_url: null,
      placeholders: ['{{accountEmail}}'],
    },
    {
      key: 'google-drive-failed',
      name: 'Google Drive Failed',
      description: 'Sent to admins when a Google Drive operation fails.',
      subject: '[Alert] Google Drive operation failed',
      headline: 'Google Drive Error',
      body: "A Google Drive operation has failed.\n\nOperation: {{operationName}}\nError: {{errorMessage}}\nTime: {{errorTime}}\n\nPlease check the integration.",
      button_label: null,
      button_url: null,
      placeholders: ['{{operationName}}', '{{errorMessage}}', '{{errorTime}}'],
    },
    {
      key: 'openai-quota-exceeded',
      name: 'OpenAI Quota Exceeded',
      description: 'Sent to admins when the OpenAI API quota is exceeded.',
      subject: '[Alert] OpenAI quota exceeded',
      headline: 'OpenAI Quota Alert',
      body: "The OpenAI API quota has been exceeded.\n\nCurrent usage: {{currentUsage}}\nQuota limit: {{quotaLimit}}\n\nPlease review your usage or upgrade your plan.",
      button_label: null,
      button_url: null,
      placeholders: ['{{currentUsage}}', '{{quotaLimit}}'],
    },
  ];

  for (const template of emailTemplates) {
    // Prisma does not support upsert on composite unique with nullable fields,
    // so we use findFirst + create manually.
    const existing = await prisma.emailTemplate.findFirst({
      where: { key: template.key, business_unit: null },
    });
    if (!existing) {
      await prisma.emailTemplate.create({
        data: {
          key: template.key,
          name: template.name,
          description: template.description,
          subject: template.subject,
          headline: template.headline,
          body: template.body,
          button_label: template.button_label ?? null,
          button_url: template.button_url ?? null,
          placeholders: template.placeholders,
          business_unit: null,
          is_active: true,
        },
      });
    }
  }

  console.log(`📧 EmailTemplates seeded: ${emailTemplates.length}`);
  console.log('✅ Editable Emails seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
