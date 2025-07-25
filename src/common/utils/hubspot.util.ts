import { Prisma } from "@prisma/client";
import { candidadeToDbDictionary, dbToCandidateDictionary } from "../dictionaries/candidate-dictionary";

interface candidateData {
    [key: string]: any;
}

export function extractDriveFileId(url: string): string | null {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]{25,})/);
    return match ? match[1] : null;
}

export function mapHubspotToDb(hubspotData: candidateData): Prisma.CandidateCreateInput {
    const result: Partial<Prisma.CandidateCreateInput> = {};

    for (const [hubspotKey, dbKey] of Object.entries(candidadeToDbDictionary)) {
        if (hubspotKey === 'name' && hubspotData.name) {
          const arrayName = hubspotData.name.trim().split(' ');
          result['first_name'] = arrayName[0];
          result['last_name'] = arrayName[arrayName.length - 1] || '';
        } else if (hubspotKey === 'nameFake') {
            //nothing to do. I add nameFake because the database need to see one value and we dont have this value in the hubspot
        } else if (hubspotData[hubspotKey] !== undefined) {
          result[dbKey] = hubspotData[hubspotKey];
        }
      }
    return result as Prisma.CandidateCreateInput;
}

export function mapDbToHubspot(data: Record<string, any>): Record<string, any> {
  
    const mappedData: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
        const hubspotKey = dbToCandidateDictionary[key];
        if (hubspotKey) {
            mappedData[hubspotKey] = value;
        }
    }
    return mappedData;
}
