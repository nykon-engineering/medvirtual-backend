import { PrismaClient } from '@prisma/client';
import { Client } from '@hubspot/api-client';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const prisma = new PrismaClient();
const hubspotClient = new Client({
  accessToken: process.env.HUBSPOT_ACCESS_TOKEN,
});

/**
 * Test script to fetch HubSpot data for InvoiceConfigurations.
 * Runs for the first 2 records to verify property names and data availability.
 */
async function testSyncInvoiceHubspot() {
  console.log('🚀 Starting Invoice HubSpot sync test (limited to 2 records)...');

  if (!process.env.HUBSPOT_ACCESS_TOKEN) {
    console.error('❌ Error: HUBSPOT_ACCESS_TOKEN is not defined in .env');
    process.exit(1);
  }

  try {
    // 1. Get first 2 InvoiceConfigurations that have a hubspot_id
    const configs = await prisma.invoiceConfiguration.findMany({
      where: {
        hubspot_id: { not: null },
      },
      take: 2,
      include: {
        organization: {
          select: {
            name: true
          }
        }
      }
    });

    if (configs.length === 0) {
      console.log('⚠️ No invoice configurations with HubSpot IDs found.');
      return;
    }

    console.log(`📦 Found ${configs.length} records to test.`);

    // 2. Fetch all available property names for companies to see everything
    console.log('🔍 Fetching all available property names for companies...');
    const allPropertiesResponse = await hubspotClient.crm.properties.coreApi.getAll('companies');
    const allPropertyNames = allPropertiesResponse.results.map(p => p.name);
    console.log(`✅ Found ${allPropertyNames.length} properties.`);

    // 3. Fetch first 5 companies from HubSpot with ALL properties
    console.log('\n🔍 Fetching first 5 companies from HubSpot...');
    const companiesPage = await hubspotClient.crm.companies.basicApi.getPage(
      5,
      undefined,
      allPropertyNames
    );

    console.log(`✅ Fetched ${companiesPage.results.length} companies.`);

    for (const company of companiesPage.results) {
      console.log(`\n--------------------------------------------------`);
      console.log(`🏢 Company Name: ${company.properties.name || 'Unknown'}`);
      console.log(`🆔 HubSpot ID: ${company.id}`);

      console.log(`✅ HubSpot Data returned:`);
      console.log(JSON.stringify(company.properties, null, 2));
    }

    console.log(`\n--------------------------------------------------`);
    console.log('🏁 Test completed.');

  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    // Close the Prisma connection
    await prisma.$disconnect();
  }
}

// Run the script
testSyncInvoiceHubspot();
