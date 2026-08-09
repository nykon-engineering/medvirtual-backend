import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const prisma = new PrismaClient();

/**
 * Initializes missing InvoiceConfiguration records for all Organizations.
 * This is a one-time script that can be run to ensure data consistency
 * without blocking the application startup.
 */
async function initInvoiceConfigs() {
  console.log('🚀 Starting Invoice Configuration initialization...');

  try {
    // 1. Find all organizations that don't have an invoiceConfiguration
    const organizationsWithoutConfig = await prisma.organization.findMany({
      where: {
        invoiceConfiguration: {
          is: null,
        },
      },
      select: {
        id: true,
        hubspot_id: true,
      },
    });

    if (organizationsWithoutConfig.length > 0) {
      console.log(`📦 Found ${organizationsWithoutConfig.length} organizations without configuration.`);
      
      // 2. Prepare the data for bulk insertion
      const data = organizationsWithoutConfig.map(org => ({
        organization_id: org.id,
        hubspot_id: org.hubspot_id,
      }));

      // 3. Perform bulk create with skipDuplicates to handle race conditions or existing records safely
      const result = await prisma.invoiceConfiguration.createMany({
        data,
        skipDuplicates: true,
      });
      
      console.log(`✅ Successfully initialized ${result.count} missing configurations.`);
    } else {
      console.log('✨ All organizations already have invoice configurations.');
    }
  } catch (error) {
    console.error('❌ Initialization failed:');
    console.error(error);
    process.exit(1);
  } finally {
    // Close the Prisma connection
    await prisma.$disconnect();
  }
}

// Run the script
initInvoiceConfigs();
