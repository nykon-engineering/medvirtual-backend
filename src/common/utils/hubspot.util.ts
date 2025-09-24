import { Prisma } from "@prisma/client";
import { candidadeToDbDictionary, dbToCandidateDictionary } from "../dictionaries/candidate-dictionary";
import { organizationToDbDictionary } from "../dictionaries/organization-dictionary";
import { CreateOrganizationDto } from "../../organization/dto/createOrganization.dto";
import { ownerToDbDictionary } from "../dictionaries/owner-dictionary";

interface candidateData {
    [key: string]: any;
}

interface organizationData {
    [key: string]: any;
}

interface ownerData {
    [key: string]: any;
}

export function extractDriveFileId(url: string): string | null {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]{25,})/);
    return match ? match[1] : null;
}

export function mapHubspotToDb(hubspotData: candidateData): Prisma.CandidateCreateInput {
    const result: Partial<Prisma.CandidateCreateInput> = {};

    for (const [hubspotKey, dbKey] of Object.entries(candidadeToDbDictionary)) {
        
        if (hubspotData[hubspotKey] !== undefined) {
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

export function mapOrganizationToDb(hubspotData: organizationData): CreateOrganizationDto {
    const result: Partial<CreateOrganizationDto> = {};

    for (const [hubspotKey, dbKey] of Object.entries(organizationToDbDictionary)) {
        
        if (hubspotData[hubspotKey] !== undefined) {
          result[dbKey] = hubspotData[hubspotKey];
        }
        
      }
    return result as CreateOrganizationDto;
}

export function mapOwnerToDb(hubspotData: ownerData): any {
    const result: Partial<any> = {};

    for (const [hubspotKey, dbKey] of Object.entries(ownerToDbDictionary)) {
        
        if (hubspotData[hubspotKey] !== undefined) {
          result[dbKey] = hubspotData[hubspotKey];
        }
        
      }
    return result as any;
}
