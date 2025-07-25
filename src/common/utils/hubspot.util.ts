import { Prisma } from "@prisma/client";
import { candidadeToDbDictionary, dbToCandidateDictionary } from "../dictionaries/candidate-dictionary";
import { stageToDbDictionary, dbToStageDictionary } from "../dictionaries/stage-dictionary";

interface candidateData {
    [key: string]: any;
}

interface StageData {
    [key: number]: string;
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


export function mapStageToDb(stage: StageData): any {
   const mappedStage: Record<string, any> = {};
    for (const [key, value] of Object.entries(stage)) {
        const dbKey = stageToDbDictionary[value];
        if (dbKey) {
            mappedStage[key] = dbKey;
        }
    }
}

export function mapDbToStage(stage: Record<string, any>): Record<string, any> {
    const mappedStage: Record<string, any> = {};
    for (const [key, value] of Object.entries(stage)) {
        const hubspotKey = dbToStageDictionary[value];
        if (hubspotKey) {
            mappedStage[key] = hubspotKey;
        }
    }
    return mappedStage;
}