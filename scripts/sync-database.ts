import { execSync } from 'child_process';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const sourceUrl = process.env.DATABASE_URL;
const targetUrl = process.env.SHADOW_DATABASE_URL;

/**
 * Syncs data from source database to target database.
 * Uses pg_dump and psql for a robust and efficient transfer.
 */
async function syncDatabase() {
  if (!sourceUrl || !targetUrl) {
    console.error('❌ Error: DATABASE_URL and SHADOW_DATABASE_URL must be defined in .env');
    process.exit(1);
  }

  console.log('🚀 Starting database sync...');
  
  // Extract host info for logging (hiding credentials)
  const getHost = (url: string) => {
    try {
      const parts = url.split('@');
      return parts.length > 1 ? parts[1] : url;
    } catch {
      return 'hidden';
    }
  };

  console.log(`📡 Source: ${getHost(sourceUrl)}`);
  console.log(`🎯 Target: ${getHost(targetUrl)}`);

  try {
    console.log('📦 Preparing target database...');
    
    // Attempt to create the database if it doesn't exist
    // We parse the database name from the URL
    const urlPattern = /postgresql:\/\/.*:.*@.*:.*\/(.*?)($|\?)/;
    const match = targetUrl.match(urlPattern);
    if (match && match[1]) {
      const dbName = match[1];
      const baseUrl = targetUrl.replace(`/${dbName}`, '/postgres');
      try {
        console.log(`🔨 Attempting to create database "${dbName}" if it doesn't exist...`);
        // We use a separate psql call to the 'postgres' database to run the CREATE DATABASE command
        execSync(`psql "${baseUrl}" -c "CREATE DATABASE ${dbName}"`, { stdio: 'ignore' });
      } catch (e) {
        // Database likely already exists or we don't have permissions to 'postgres' DB, which is fine
      }
    }

    console.log('📦 Dumping from source and restoring to target... This may take a moment.');

    /**
     * pg_dump options:
     * --clean: Drop database objects before recreating them
     * --if-exists: Use IF EXISTS when dropping objects
     * --no-owner: Do not output commands to set ownership of objects
     * --no-privileges: Do not output commands to set access privileges
     */
    const command = `pg_dump "${sourceUrl}" --clean --if-exists --no-owner --no-privileges | psql "${targetUrl}"`;

    // Execute the command and pipe output to terminal
    execSync(command, { stdio: 'inherit' });

    console.log('✅ Database sync completed successfully!');
  } catch (error: any) {
    console.error('❌ Database sync failed:');
    console.error(error.message);
    console.log('\n💡 Tip: Make sure your local Postgres server is running and your credentials in .env are correct.');
    process.exit(1);
  }
}

syncDatabase();
