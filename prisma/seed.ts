import {
  PrismaClient,
  OrganizationRole,
  OrganizationStatus,
  HireRequestStatus,
  TicketStatus,
  Priority,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

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
  console.log('🌱 Starting database seeding...');

  // Check if data already exists
  const existingUsers = await prisma.uSER.count();
  if (existingUsers > 0) {
    console.log('📊 Database already has data. Skipping seeding...');
    console.log(`- Users: ${await prisma.uSER.count()}`);
    console.log(`- Organizations: ${await prisma.organization.count()}`);
    console.log(`- Candidates: ${await prisma.candidate.count()}`);
    console.log(`- Hire requests: ${await prisma.hireRequest.count()}`);
    console.log(`- Tickets: ${await prisma.ticket.count()}`);
    return;
  }

  // Hash passwords
  const hashedPasswords = {
    anthony: await bcrypt.hash('Iddk1234$#', 10),
    lnardon: await bcrypt.hash('Storeroom3-Flatfoot9-Yelp2-Askew1-Tasty0@', 10),
    lucas: await bcrypt.hash(
      'Paternal7-Rasping6-Stapling3-Playback8-Tadpole6@',
      10,
    ),
  };

  console.log('🔐 Passwords hashed successfully');

  // Create System Super Admin (lnardon@proton.me)
  const systemSuperAdmin = await prisma.uSER.create({
    data: {
      email: 'lnardon@proton.me',
      password: hashedPasswords.lnardon,
      role: 'system_super_admin',
      first_name: 'Lucas',
      last_name: 'Nardon',
      organization_name: 'MedVirtual System',
      phone: '+1-555-0101',
      avatar: '',
      job_title: 'System Administrator',
      workos_id: '',
      authentication_method: 'OwnSign',
      status: 'active',
      is_organization_owner: false,
      verified: true,
      createdByMethod: 'system_created',
      createdByUserId: null,
    },
  });

  console.log('👤 System Super Admin created:', systemSuperAdmin.email);

  // Create Organization Super Admin (anthony16604@gmail.com)
  const orgSuperAdmin = await prisma.uSER.create({
    data: {
      email: 'anthony16604@gmail.com',
      password: hashedPasswords.anthony,
      role: 'organization_super_admin',
      first_name: 'Anthony',
      last_name: 'Smith',
      organization_name: 'MedTech Solutions',
      phone: '+1-555-0102',
      avatar: '',
      job_title: 'CEO',
      workos_id: '',
      authentication_method: 'OwnSign',
      status: 'active',
      is_organization_owner: true,
      verified: true,
      createdByMethod: 'system_created',
      createdByUserId: null,
    },
  });

  console.log('👤 Organization Super Admin created:', orgSuperAdmin.email);

  // Create Organization Admin (lucas+22@regenta.ai)
  const orgAdmin = await prisma.uSER.create({
    data: {
      email: 'lucas+22@regenta.ai',
      password: hashedPasswords.lucas,
      role: 'organization_admin',
      first_name: 'Lucas',
      last_name: 'Johnson',
      organization_name: 'Regenta Medical',
      phone: '+1-555-0103',
      avatar: '',
      job_title: 'Operations Manager',
      workos_id: '',
      authentication_method: 'OwnSign',
      status: 'active',
      is_organization_owner: true,
      verified: true,
      createdByMethod: 'system_created',
      createdByUserId: null,
    },
  });

  console.log('👤 Organization Admin created:', orgAdmin.email);

  // Create additional system admins for admin assignment
  const systemAdmin1 = await prisma.uSER.create({
    data: {
      email: 'admin1@medvirtual.com',
      password: await bcrypt.hash('Admin123!', 10),
      role: 'system_admin',
      first_name: 'Sarah',
      last_name: 'Wilson',
      organization_name: 'MedVirtual System',
      phone: '+1-555-0104',
      avatar: '',
      job_title: 'System Administrator',
      workos_id: '',
      authentication_method: 'OwnSign',
      status: 'active',
      is_organization_owner: false,
      verified: true,
      createdByMethod: 'system_created',
      createdByUserId: null,
    },
  });

  const systemAdmin2 = await prisma.uSER.create({
    data: {
      email: 'admin2@medvirtual.com',
      password: await bcrypt.hash('Admin456!', 10),
      role: 'system_admin',
      first_name: 'Michael',
      last_name: 'Brown',
      organization_name: 'MedVirtual System',
      phone: '+1-555-0105',
      avatar: '',
      job_title: 'System Administrator',
      workos_id: '',
      authentication_method: 'OwnSign',
      status: 'active',
      is_organization_owner: false,
      verified: true,
      createdByMethod: 'system_created',
      createdByUserId: null,
    },
  });

  console.log('👥 Additional system admins created');

  // Create Organization 1: MedTech Solutions (Client)
  const organization1 = await prisma.organization.create({
    data: {
      name: 'MedTech Solutions',
      email: 'contact@medtechsolutions.com',
      phone: '+1-555-0201',
      website_url: 'https://medtechsolutions.com',
      location: 'San Francisco, CA',
      description:
        'Leading provider of medical technology solutions for healthcare providers.',
      industry: 'Healthcare Technology',
      organization_role: OrganizationRole.client,
      number_of_employees: 150,
      date_founded: new Date('2018-03-15'),
      date_joined: new Date('2023-01-15'),
      date_became_client: new Date('2023-02-01'),
      status: OrganizationStatus.active,
      signed_document_url:
        'https://docs.medvirtual.com/contracts/medtech-solutions-signed.pdf',
      signed_document_date: new Date('2023-02-01'),
      specialties: [
        'Medical Software',
        'Healthcare Analytics',
        'Patient Management Systems',
      ],
      services: [
        'Software Development',
        'System Integration',
        'Technical Support',
        'Training',
      ],
      owner_id: orgSuperAdmin.id,
      admin_id: systemAdmin1.id,
    },
  });

  // Update user with organization_id
  await prisma.uSER.update({
    where: { id: orgSuperAdmin.id },
    data: { organization_id: organization1.id },
  });

  console.log('🏢 Organization 1 created:', organization1.name);

  // Create Organization 2: Regenta Medical (Prospect)
  const organization2 = await prisma.organization.create({
    data: {
      name: 'Regenta Medical',
      email: 'info@regentamedical.com',
      phone: '+1-555-0202',
      website_url: 'https://regentamedical.com',
      location: 'Boston, MA',
      description:
        'Innovative medical device company specializing in diagnostic equipment.',
      industry: 'Medical Devices',
      organization_role: OrganizationRole.prospect,
      number_of_employees: 75,
      date_founded: new Date('2020-07-20'),
      date_joined: new Date('2024-01-10'),
      status: OrganizationStatus.active,
      specialties: [
        'Diagnostic Equipment',
        'Medical Imaging',
        'Laboratory Systems',
      ],
      services: ['Equipment Sales', 'Installation', 'Maintenance', 'Training'],
      owner_id: orgAdmin.id,
      admin_id: systemAdmin2.id,
    },
  });

  // Update user with organization_id
  await prisma.uSER.update({
    where: { id: orgAdmin.id },
    data: { organization_id: organization2.id },
  });

  console.log('🏢 Organization 2 created:', organization2.name);

  // Create additional organizations for testing
  const organization3 = await prisma.organization.create({
    data: {
      name: 'HealthCare Plus',
      email: 'contact@healthcareplus.com',
      phone: '+1-555-0203',
      website_url: 'https://healthcareplus.com',
      location: 'Chicago, IL',
      description: 'Comprehensive healthcare services provider.',
      industry: 'Healthcare Services',
      organization_role: OrganizationRole.client,
      number_of_employees: 200,
      date_founded: new Date('2015-11-10'),
      date_joined: new Date('2023-06-01'),
      date_became_client: new Date('2023-07-15'),
      status: OrganizationStatus.active,
      signed_document_url:
        'https://docs.medvirtual.com/contracts/healthcare-plus-signed.pdf',
      signed_document_date: new Date('2023-07-15'),
      specialties: ['Primary Care', 'Specialty Services', 'Emergency Care'],
      services: ['Medical Services', 'Diagnostic Testing', 'Preventive Care'],
      admin_id: systemAdmin1.id,
    },
  });

  const organization4 = await prisma.organization.create({
    data: {
      name: 'MediCorp International',
      email: 'info@medicorp.com',
      phone: '+1-555-0204',
      website_url: 'https://medicorp.com',
      location: 'New York, NY',
      description: 'Global pharmaceutical and biotechnology company.',
      industry: 'Pharmaceuticals',
      organization_role: OrganizationRole.prospect,
      number_of_employees: 500,
      date_founded: new Date('2010-05-12'),
      date_joined: new Date('2024-02-01'),
      status: OrganizationStatus.active,
      specialties: ['Drug Development', 'Clinical Research', 'Biotechnology'],
      services: ['Research & Development', 'Manufacturing', 'Distribution'],
      admin_id: systemAdmin2.id,
    },
  });

  console.log('🏢 Additional organizations created');

  // Create additional users for the organizations
  const additionalUsers = [
    {
      email: 'john.doe@medtechsolutions.com',
      password: await bcrypt.hash('User123!', 10),
      role: 'organization_admin',
      first_name: 'John',
      last_name: 'Doe',
      organization_name: 'MedTech Solutions',
      phone: '+1-555-0301',
      job_title: 'CTO',
      organization_id: organization1.id,
    },
    {
      email: 'jane.smith@medtechsolutions.com',
      password: await bcrypt.hash('User456!', 10),
      role: 'organization_user',
      first_name: 'Jane',
      last_name: 'Smith',
      organization_name: 'MedTech Solutions',
      phone: '+1-555-0302',
      job_title: 'Software Engineer',
      organization_id: organization1.id,
    },
    {
      email: 'mike.wilson@regentamedical.com',
      password: await bcrypt.hash('User789!', 10),
      role: 'organization_admin',
      first_name: 'Mike',
      last_name: 'Wilson',
      organization_name: 'Regenta Medical',
      phone: '+1-555-0303',
      job_title: 'VP of Operations',
      organization_id: organization2.id,
    },
    {
      email: 'sarah.jones@healthcareplus.com',
      password: await bcrypt.hash('User101!', 10),
      role: 'organization_super_admin',
      first_name: 'Sarah',
      last_name: 'Jones',
      organization_name: 'HealthCare Plus',
      phone: '+1-555-0304',
      job_title: 'CEO',
      organization_id: organization3.id,
    },
  ];

  for (const userData of additionalUsers) {
    await prisma.uSER.create({
      data: {
        ...userData,
        avatar: '',
        workos_id: '',
        authentication_method: 'OwnSign',
        status: 'active',
        is_organization_owner: userData.role === 'organization_super_admin',
        verified: true,
      },
    });
  }

  console.log('👥 Additional users created');

  // Create some candidates
  const candidates = [
    {
      first_name: 'Alice',
      last_name: 'Johnson',
      email: 'alice.johnson@email.com',
      hubspot_id: 'alice-johnson-001',
      organization_id: organization1.id,
    },
    {
      first_name: 'Bob',
      last_name: 'Williams',
      email: 'bob.williams@email.com',
      hubspot_id: 'bob-williams-002',
      organization_id: organization2.id,
    },
    {
      first_name: 'Carol',
      last_name: 'Davis',
      email: 'carol.davis@email.com',
      hubspot_id: 'carol-davis-003',
      organization_id: organization3.id,
    },
  ];

  for (const candidateData of candidates) {
    await prisma.candidate.create({
      data: {
        ...candidateData,
        years_of_experience: Math.floor(Math.random() * 10) + 1,
        country: 'United States',
        specialization: 'Software Development',
        employment_type: 'Full-time',
        name: `${candidateData.first_name} ${candidateData.last_name}`,
      },
    });
  }

  console.log('👨‍💼 Candidates created');

  // Create some hire requests
  const hireRequests = [
    {
      title: 'Senior Software Engineer',
      description:
        'Looking for an experienced software engineer to join our development team.',
      org_id: organization1.id,
    },
    {
      title: 'DevOps Engineer',
      description: 'Need a DevOps engineer to manage our cloud infrastructure.',
      org_id: organization2.id,
    },
  ];

  for (const requestData of hireRequests) {
    await prisma.hireRequest.create({
      data: {
        ...requestData,
        status: HireRequestStatus.new,
        priority: Priority.medium,
        salary_range_from: 80000,
        salary_range_to: 120000,
        expected_start_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        availability: 'Immediate',
        specialization: 'Software Development',
        location: 'Remote',
      },
    });
  }

  console.log('📋 Hire requests created');

  // Create some tickets
  const tickets = [
    {
      title: 'Login Issue',
      description: 'Users are unable to log in to the system.',
      type: 'bug',
      org_id: organization1.id,
      user_id: orgSuperAdmin.id,
    },
    {
      title: 'Feature Request',
      description: 'Need to add bulk import functionality.',
      type: 'feature',
      org_id: organization2.id,
      user_id: orgAdmin.id,
    },
  ];

  for (const ticketData of tickets) {
    await prisma.ticket.create({
      data: {
        ...ticketData,
        status: TicketStatus.new,
        priority: Priority.high,
      },
    });
  }

  console.log('🎫 Support tickets created');

  // Seed PositionRateConfig from dictionaries
  const allPositions = new Set([
    ...Object.keys(floorPriceEnglish),
    ...Object.keys(floorPriceBilingual),
  ]);

  for (const position of allPositions) {
    await prisma.positionRateConfig.upsert({
      where: { position },
      update: {},
      create: {
        position,
        floor_price_english: floorPriceEnglish[position] ?? null,
        floor_price_bilingual: floorPriceBilingual[position] ?? null,
        hourly_rate_english: null,
        hourly_rate_bilingual: null,
        margin_per_hour: null,
      },
    });
  }

  console.log(`💰 PositionRateConfig seeded: ${allPositions.size} positions`);

  console.log('✅ Database seeding completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`- Users created: ${await prisma.uSER.count()}`);
  console.log(`- Organizations created: ${await prisma.organization.count()}`);
  console.log(`- Candidates created: ${await prisma.candidate.count()}`);
  console.log(`- Hire requests created: ${await prisma.hireRequest.count()}`);
  console.log(`- Tickets created: ${await prisma.ticket.count()}`);
  console.log(`- Position rate configs: ${await prisma.positionRateConfig.count()}`);

  console.log('\n🔑 Login Credentials:');
  console.log('System Super Admin: lnardon@proton.me');
  console.log('Organization Super Admin: anthony16604@gmail.com');
  console.log('Organization Admin: lucas+22@regenta.ai');
  console.log(
    '\nPasswords are the ones you provided and are properly encrypted.',
  );
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
