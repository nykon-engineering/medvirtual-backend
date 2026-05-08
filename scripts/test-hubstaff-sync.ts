import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { HubstaffService } from '../src/hubstaff/hubstaff.service';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Test script to verify Hubstaff connection using the new HubstaffService.
 */
async function testHubstaffSync() {
  console.log('🚀 Starting Hubstaff connection test using HubstaffService...');

  const app = await NestFactory.createApplicationContext(AppModule);
  const hubstaffService = app.get(HubstaffService);

  try {
    const projectId = '3946055';
    console.log(`📡 Fetching Hubstaff project details for ID: ${projectId}...`);

    const project = await hubstaffService.getProjectById(projectId);

    console.log('✅ Hubstaff API response received:');
    console.log(JSON.stringify(project, null, 2));

  } catch (error: any) {
    console.error('❌ Test failed:');
    if (error.response) {
      console.error(`Status: ${error.response.status} ${error.response.statusText}`);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error Message:', error.message);
    }
  } finally {
    await app.close();
  }
}

// Run the script
testHubstaffSync();
