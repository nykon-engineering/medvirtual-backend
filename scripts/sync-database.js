"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const sourceUrl = process.env.DATABASE_URL;
const targetUrl = process.env.SHADOW_DATABASE_URL;
async function syncDatabase() {
    if (!sourceUrl || !targetUrl) {
        console.error('❌ Error: DATABASE_URL and SHADOW_DATABASE_URL must be defined in .env');
        process.exit(1);
    }
    console.log('🚀 Starting database sync...');
    const getHost = (url) => {
        try {
            const parts = url.split('@');
            return parts.length > 1 ? parts[1] : url;
        }
        catch {
            return 'hidden';
        }
    };
    console.log(`📡 Source: ${getHost(sourceUrl)}`);
    console.log(`🎯 Target: ${getHost(targetUrl)}`);
    try {
        console.log('📦 Preparing target database...');
        const urlPattern = /postgresql:\/\/.*:.*@.*:.*\/(.*?)($|\?)/;
        const match = targetUrl.match(urlPattern);
        if (match && match[1]) {
            const dbName = match[1];
            const baseUrl = targetUrl.replace(`/${dbName}`, '/postgres');
            try {
                console.log(`🔨 Attempting to create database "${dbName}" if it doesn't exist...`);
                (0, child_process_1.execSync)(`psql "${baseUrl}" -c "CREATE DATABASE ${dbName}"`, { stdio: 'ignore' });
            }
            catch (e) {
            }
        }
        console.log('📦 Dumping from source and restoring to target... This may take a moment.');
        const command = `pg_dump "${sourceUrl}" --clean --if-exists --no-owner --no-privileges | psql "${targetUrl}"`;
        (0, child_process_1.execSync)(command, { stdio: 'inherit' });
        console.log('✅ Database sync completed successfully!');
    }
    catch (error) {
        console.error('❌ Database sync failed:');
        console.error(error.message);
        console.log('\n💡 Tip: Make sure your local Postgres server is running and your credentials in .env are correct.');
        process.exit(1);
    }
}
syncDatabase();
//# sourceMappingURL=sync-database.js.map