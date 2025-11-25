import { BadRequestException, Injectable } from "@nestjs/common";

import { mapDbToHubspot, mapHubspotToDb } from "../../common/utils/hubspot.util";
import { PrismaService } from "../../prisma/prisma.service";



@Injectable()
export class HandlerObjectMerge {
    constructor(
        private readonly prisma: PrismaService,
    ){}

    private mergeCandidateData(primary: any, merged: any): Partial<any> {
        const mergedAsHubspot = mapDbToHubspot(merged);

        const dbMapped = mapHubspotToDb(mergedAsHubspot);

        const updateData: Record<string, any> = {};

        for (const [key, value] of Object.entries(dbMapped)) {
            const primaryValue = primary[key];

            if ((primaryValue === null || primaryValue === undefined || primaryValue === '') && value) {
            updateData[key] = value;
            }
        }

        return updateData;
    }



    async execute(event){

        try{
            console.log('Executing object merge handler for event:', event)
            const primaryCompany = await this.prisma.candidate.findUnique({
                where: { hubspot_id: event.primaryObjectId }
            });
            if (!primaryCompany) {
                throw new BadRequestException(`Primary company hubspotId=${event.primaryObjectId} not found in database.`);
            }

            const otherMergedIds = event.mergedObjectIds.filter(
                id => id !== event.primaryObjectId
            );

            console.log('Other merged IDs:', otherMergedIds);
            console.log('Primary company:', primaryCompany);
            console.log('Starting to fetch merged companies...');
            
            const mergedCompanies = await this.prisma.candidate.findMany({
            where: {
                hubspot_id: { in: otherMergedIds }
            }
            });

            if (mergedCompanies.length === 0) {
                throw new BadRequestException(`No merged companies found with the provided HubSpot IDs.`);
            }

            let dataToUpdate: Record<string, any> = {};
            for (const merged of mergedCompanies) {
                const partialUpdate = this.mergeCandidateData(primaryCompany, merged);

                dataToUpdate = {
                ...dataToUpdate,
                ...partialUpdate
                };
            }

            if (Object.keys(dataToUpdate).length > 0) {
                await this.prisma.candidate.update({
                    where: { hubspot_id: event.primaryObjectId },
                    data: dataToUpdate
                });
            }

            await this.prisma.candidate.update({
                where: { hubspot_id: event.primaryObjectId },
                data: {
                    hubspot_id: event.newObjectId
                }
            });

            await this.prisma.candidate.deleteMany({
                where: { 
                    hubspot_id: { in: otherMergedIds },
                }
            });
            

        }catch(error){
            throw new BadRequestException(`HandlerObjectMerge: ${error.message}`);
        }


    }
}