import { PrismaClient, OrganizationStatus, OrganizationRole } from '@prisma/client';
import { Client } from '@hubspot/api-client';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const prisma = new PrismaClient();
const hubspotClient = new Client({
  accessToken: process.env.HUBSPOT_ACCESS_TOKEN,
});

/**
 * HubSpot to DB Organization Mapping Dictionary
 */
const organizationToDbDictionary: Record<string, string> = {
  hs_object_id: 'hubspot_id',
  name: 'name',
  about_us: 'description',
  address: 'address',
  city: 'city',
  state: 'state',
  zip: 'postal_code',
  country: 'location',
  domain: 'website_url',
  description: 'description',
  industry: 'industry',
  numberofemployees: 'number_of_employees',
  phone: 'phone',
  referral_email: 'email',
  specialty: 'specialties',
  type: 'type',
  business_unit: 'business_unit',
  hubspot_owner_id: 'hubspot_owner_id',
  hubspot_project_id: 'hubspot_project_id',
};

/**
 * Industry Mapping Dictionary
 */
const organizationIndustryToDbDictionary: Record<string, string> = {
  ACCOUNTING: 'Accounting',
  AGRICULTURE: 'Agriculture',
  AIRLINES_AVIATION: 'Airlines/Aviation',
  ALTERNATIVE_DISPUTE_RESOLUTION: 'Alternative Dispute Resolution',
  ALTERNATIVE_MEDICINE: 'Alternative Medicine',
  ANIMATION: 'Animation',
  APPAREL_FASHION: 'Apparel & Fashion',
  ARCHITECTURE_PLANNING: 'Architecture & Planning',
  ARTS_CRAFTS: 'Arts & Crafts',
  AUTOMOTIVE: 'Automotive',
  AVIATION_AEROSPACE: 'Aviation & Aerospace',
  BANKING: 'Banking',
  BIOTECHNOLOGY: 'Biotechnology',
  BROADCAST_MEDIA: 'Broadcast Media',
  BUILDING_MATERIALS: 'Building Materials',
  BUSINESS_SUPPLIES_EQUIPMENT: 'Business Supplies & Equipment',
  CAPITAL_MARKETS: 'Capital Markets',
  CHEMICALS: 'Chemicals',
  CIVIC_SOCIAL_ORGANIZATION: 'Civic & Social Organization',
  CIVIL_ENGINEERING: 'Civil Engineering',
  COMMERCIAL_REAL_ESTATE: 'Commercial Real Estate',
  COMPUTER_NETWORK_SECURITY: 'Computer & Network Security',
  COMPUTER_GAMES: 'Computer Games',
  COMPUTER_HARDWARE: 'Computer Hardware',
  COMPUTER_NETWORKING: 'Computer Networking',
  COMPUTER_SOFTWARE: 'Computer Software',
  CONSTRUCTION: 'Construction',
  CONSUMER_ELECTRONICS: 'Consumer Electronics',
  CONSUMER_GOODS: 'Consumer Goods',
  CONSUMER_SERVICES: 'Consumer Services',
  COSMETICS: 'Cosmetics',
  DAIRY: 'Dairy',
  DEFENSE_SPACE: 'Defense & Space',
  DESIGN: 'Design',
  EDUCATION_MANAGEMENT: 'Education Management',
  E_LEARNING: 'E-Learning',
  ELECTRICAL_ELECTRONIC_MANUFACTURING: 'Electrical & Electronic Manufacturing',
  ENTERTAINMENT: 'Entertainment',
  ENVIRONMENTAL_SERVICES: 'Environmental Services',
  EVENTS_SERVICES: 'Events Services',
  EXECUTIVE_OFFICE: 'Executive Office',
  FACILITIES_SERVICES: 'Facilities Services',
  FARMING: 'Farming',
  FINANCIAL_SERVICES: 'Financial Services',
  FINE_ART: 'Fine Art',
  FISHERY: 'Fishery',
  FOOD_BEVERAGES: 'Food & Beverages',
  FOOD_PRODUCTION: 'Food Production',
  FUND_RAISING: 'Fund-Raising',
  FURNITURE: 'Furniture',
  GAMBLING_CASINOS: 'Gambling & Casinos',
  GLASS_CERAMICS_CONCRETE: 'Glass, Ceramics & Concrete',
  GOVERNMENT_ADMINISTRATION: 'Government Administration',
  GOVERNMENT_RELATIONS: 'Government Relations',
  GRAPHIC_DESIGN: 'Graphic Design',
  HEALTH_WELLNESS_FITNESS: 'Health, Wellness & Fitness',
  HIGHER_EDUCATION: 'Higher Education',
  HOSPITAL_HEALTH_CARE: 'Hospital & Health Care',
  HOSPITALITY: 'Hospitality',
  HUMAN_RESOURCES: 'Human Resources',
  IMPORT_EXPORT: 'Import & Export',
  INDIVIDUAL_FAMILY_SERVICES: 'Individual & Family Services',
  INDUSTRIAL_AUTOMATION: 'Industrial Automation',
  INFORMATION_SERVICES: 'Information Services',
  INFORMATION_TECHNOLOGY_SERVICES: 'Information Technology & Services',
  INSURANCE: 'Insurance',
  INTERNATIONAL_AFFAIRS: 'International Affairs',
  INTERNATIONAL_TRADE_DEVELOPMENT: 'International Trade & Development',
  INTERNET: 'Internet',
  INVESTMENT_BANKING: 'Investment Banking',
  INVESTMENT_MANAGEMENT: 'Investment Management',
  JUDICIARY: 'Judiciary',
  LAW_ENFORCEMENT: 'Law Enforcement',
  LAW_PRACTICE: 'Law Practice',
  LEGAL_SERVICES: 'Legal Services',
  LEGISLATIVE_OFFICE: 'Legislative Office',
  LEISURE_TRAVEL_TOURISM: 'Leisure, Travel & Tourism',
  LIBRARIES: 'Libraries',
  LOGISTICS_SUPPLY_CHAIN: 'Logistics & Supply Chain',
  LUXURY_GOODS_JEWELRY: 'Luxury Goods & Jewelry',
  MACHINERY: 'Machinery',
  MANAGEMENT_CONSULTING: 'Management Consulting',
  MARITIME: 'Maritime',
  MARKETING_ADVERTISING: 'Marketing & Advertising',
  MARKET_RESEARCH: 'Market Research',
  MECHANICAL_OR_INDUSTRIAL_ENGINEERING: 'Mechanical or Industrial Engineering',
  MEDIA_PRODUCTION: 'Media Production',
  RESTAURANTS: 'Restaurants',
  RETAIL: 'Retail',
  SECURITY_INVESTIGATIONS: 'Security & Investigations',
  SEMICONDUCTORS: 'Semiconductors',
  SHIPBUILDING: 'Shipbuilding',
  SPORTS: 'Sports',
  STAFFING_RECRUITING: 'Staffing & Recruiting',
  SUPERMARKETS: 'Supermarkets',
  TELECOMMUNICATIONS: 'Telecommunications',
  TEXTILES: 'Textiles',
  THINK_TANKS: 'Think Tanks',
  TOBACCO: 'Tobacco',
  TRANSLATION_LOCALIZATION: 'Translation & Localization',
  TRANSPORTATION_TRUCKING_RAILROAD: 'Transportation/Trucking/Railroad',
  UTILITIES: 'Utilities',
  VENTURE_CAPITAL_PRIVATE_EQUITY: 'Venture Capital & Private Equity',
  VETERINARY: 'Veterinary',
  WAREHOUSING: 'Warehousing',
  WHOLESALE: 'Wholesale',
  WINE_SPIRITS: 'Wine & Spirits',
  WIRELESS: 'Wireless',
  WRITING_EDITING: 'Writing & Editing',
};

/**
 * Main script to sync HubSpot companies to Organizations and InvoiceConfigurations.
 */
async function testSyncInvoiceHubspot() {
  console.log('🚀 Starting HubSpot Companies to Organizations sync...');

  if (!process.env.HUBSPOT_ACCESS_TOKEN) {
    console.error('❌ Error: HUBSPOT_ACCESS_TOKEN is not defined in .env');
    process.exit(1);
  }

  try {
    let after: string | undefined = '0';
    let totalProcessed = 0;
    let totalCreated = 0;
    let totalExisting = 0;
    let totalConfigsAdded = 0;

    const properties = Object.keys(organizationToDbDictionary);

    do {
      console.log(`\n🔍 Fetching batch of companies from HubSpot... ${after ? '(paging after: ' + after + ')' : ''}`);

      const searchResponse = await hubspotClient.crm.companies.searchApi.doSearch({
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'business_unit',
                operator: 'EQ' as any,
                value: 'MedVirtual'
              }
            ]
          },
          {
            filters: [
              {
                propertyName: 'business_unit',
                operator: 'EQ' as any,
                value: 'Berry Virtual'
              }
            ]
          }
        ],
        properties,
        limit: 100,
        after
      });

      const companies = searchResponse.results;
      if (companies.length === 0) break;

      console.log(`✅ Fetched ${companies.length} companies from HubSpot.`);

      // 1. Bulk fetch existing Organizations and their InvoiceConfigurations
      const hubspotIds = companies.map(c => c.id);
      const existingOrgs = await prisma.organization.findMany({
        where: { hubspot_id: { in: hubspotIds } },
        include: { invoiceConfiguration: true }
      });
      const orgMap = new Map(existingOrgs.map(o => [o.hubspot_id, o]));

      // 2. Bulk fetch HubSpot Owners to map as Admins
      const ownerIds = Array.from(new Set(companies.map(c => String(c.properties.hubspot_owner_id)).filter(id => id && id !== 'null')));
      const users = await prisma.uSER.findMany({
        where: { hubspot_id: { in: ownerIds } },
        select: { id: true, hubspot_id: true }
      });
      const userMap = new Map(users.map(u => [u.hubspot_id, u.id]));

      // 3. Prepare processing results
      const orgsToCreate: any[] = [];
      const configsToCreate: any[] = [];
      const configsToUpdate: any[] = [];

      // Parallelize the mapping and check logic
      await Promise.all(companies.map(async (company) => {
        const hubspotId = company.id;
        const props = company.properties;
        const existing = orgMap.get(hubspotId);

        if (existing) {
          totalExisting++;
          const config = (existing as any).invoiceConfiguration;

          if (!config) {
            configsToCreate.push({
              organization_id: existing.id,
              hubspot_id: hubspotId,
              hubstaff_id: props.hubspot_project_id ? String(props.hubspot_project_id) : undefined,
            });
          } else if (props.hubspot_project_id && String(props.hubspot_project_id) !== config.hubstaff_id) {
            console.log(`🔄 Queuing update for ${props.name}: ${config.hubstaff_id} -> ${props.hubspot_project_id}`);
            configsToUpdate.push({
              id: config.id,
              hubstaff_id: String(props.hubspot_project_id)
            });
          }
          return;
        }

        // Prepare new organization data
        const adminId = userMap.get(String(props.hubspot_owner_id)) || null;
        const specialties = props.specialty ? props.specialty.split(';').map((s: string) => s.trim()) : [];
        const role = props.type === 'PROSPECT' ? OrganizationRole.prospect : OrganizationRole.client;

        orgsToCreate.push({
          hubspot_id: hubspotId,
          name: props.name || 'Unknown HubSpot Company',
          email: props.referral_email || null,
          phone: props.phone || null,
          website_url: props.domain || null,
          address: props.address || null,
          city: props.city || null,
          state: props.state || null,
          postal_code: props.zip || null,
          location: props.country || null,
          description: props.description || props.about_us || null,
          industry: props.industry ? (organizationIndustryToDbDictionary[props.industry] || props.industry) : null,
          business_unit: props.business_unit || null,
          organization_role: role,
          number_of_employees: props.numberofemployees ? parseInt(props.numberofemployees) : null,
          status: OrganizationStatus.inactive,
          specialties: specialties,
          admin_id: adminId,
          source: 'Hubspot',
        });
      }));

      // 4. Bulk Create Organizations
      if (orgsToCreate.length > 0) {
        console.log(`🆕 Creating ${orgsToCreate.length} new organizations...`);
        await prisma.organization.createMany({
          data: orgsToCreate,
          skipDuplicates: true
        });

        // Fetch back to get IDs for InvoiceConfiguration creation
        const newOrgs = await prisma.organization.findMany({
          where: { hubspot_id: { in: orgsToCreate.map(o => o.hubspot_id) } },
          select: { id: true, hubspot_id: true }
        });

        const newConfigs = newOrgs.map(org => {
          const company = companies.find(c => c.id === org.hubspot_id);
          return {
            organization_id: org.id,
            hubspot_id: org.hubspot_id,
            hubstaff_id: company?.properties.hubspot_project_id ? String(company.properties.hubspot_project_id) : undefined,
          };
        });

        if (newConfigs.length > 0) {
          await prisma.invoiceConfiguration.createMany({ data: newConfigs });
        }
        totalCreated += orgsToCreate.length;
      }

      // 5. Bulk Create missing InvoiceConfigurations for existing orgs
      if (configsToCreate.length > 0) {
        console.log(`🛠️ Adding ${configsToCreate.length} missing InvoiceConfigurations...`);
        await prisma.invoiceConfiguration.createMany({ data: configsToCreate });
        totalConfigsAdded += configsToCreate.length;
      }

      // 6. Execute Updates in batches to avoid connection pool exhaustion
      if (configsToUpdate.length > 0) {
        console.log(`🔄 Updating ${configsToUpdate.length} existing InvoiceConfigurations...`);
        const updateBatchSize = 10;
        for (let j = 0; j < configsToUpdate.length; j += updateBatchSize) {
          const updateChunk = configsToUpdate.slice(j, j + updateBatchSize);
          await Promise.all(updateChunk.map(upd =>
            prisma.invoiceConfiguration.update({
              where: { id: upd.id },
              data: { hubstaff_id: upd.hubstaff_id }
            })
          ));
        }
      }

      totalProcessed += companies.length;
      after = searchResponse.paging?.next?.after;
    } while (after);

    console.log(`\n--------------------------------------------------`);
    console.log(`🏁 Sync completed.`);
    console.log(`📊 Total HubSpot companies processed: ${totalProcessed}`);
    console.log(`✨ New organizations created: ${totalCreated}`);
    console.log(`✅ Organizations already existing: ${totalExisting}`);
    console.log(`🛠️ Missing InvoiceConfigs added: ${totalConfigsAdded}`);
    console.log(`--------------------------------------------------`);

  } catch (error: any) {
    console.error('❌ Script failed:', error.response?.data || error.message || error);
  } finally {
    // Close the Prisma connection
    await prisma.$disconnect();
  }
}

// Run the script
testSyncInvoiceHubspot();
