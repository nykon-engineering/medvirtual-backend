import { hubspotToDbDictionary, dbToHubspotDictionary } from "../dictionaries/hubspot-dictionary";

export function extractDriveFileId(url: string): string | null {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]{25,})/);
    return match ? match[1] : null;
}

export function mapHubspotToDb(data: Record<string, any>): Record<string, any> {
    const mappedData: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
        const dbKey = hubspotToDbDictionary[key];
        if (dbKey) {
            mappedData[dbKey] = value;
        }
    }
    return mappedData;
}

export function mapDbToHubspot(data: Record<string, any>): Record<string, any> {
    const mappedData: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
        const hubspotKey = dbToHubspotDictionary[key];
        if (hubspotKey) {
            mappedData[hubspotKey] = value;
        }
    }
    return mappedData;
}