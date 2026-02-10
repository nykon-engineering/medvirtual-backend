import { BadRequestException, Injectable } from "@nestjs/common";

import { mapDbToOrganization, mapOrganizationToDb } from "../../common/utils/hubspot.util";
import { PrismaService } from "../../prisma/prisma.service";



@Injectable()
export class HandlerOrganizationMerge {
    constructor(
        private readonly prisma: PrismaService,
    ){}

    private mergeOrganizationData(primary: any, merged: any): Partial<any> {
        const mergedAsHubspot = mapDbToOrganization(merged);

        const dbMapped = mapOrganizationToDb(mergedAsHubspot);

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
            const primaryOrganization = await this.prisma.organization.findUnique({
                where: { hubspot_id: String(event.primaryObjectId) }
            });
            if (!primaryOrganization) {
                throw new BadRequestException(`Primary company hubspotId=${event.primaryObjectId} not found in database.`);
            }

            
            const otherMergedIds = event.mergedObjectIds
                .map(id => String(id))
                .filter(
                id => id !== String(event.primaryObjectId)
            );

            
            const mergedCompanies = await this.prisma.organization.findMany({
            where: {
                hubspot_id: { in: otherMergedIds }
            }
            });

            if (mergedCompanies.length === 0) {
                throw new BadRequestException(`No merged companies found with the provided HubSpot IDs.`);
            }

            let dataToUpdate: Record<string, any> = {};
            for (const merged of mergedCompanies) {
                const partialUpdate = this.mergeOrganizationData(primaryOrganization, merged);

                dataToUpdate = {
                ...dataToUpdate,
                ...partialUpdate
                };
            }

            if (Object.keys(dataToUpdate).length > 0) {
                await this.prisma.organization.update({
                    where: { hubspot_id: String(event.primaryObjectId) },
                    data: dataToUpdate
                });
            }

            await this.prisma.organization.update({
                where: { hubspot_id: String(event.primaryObjectId) },
                data: {
                    hubspot_id: String(event.newObjectId)
                }
            });

            await this.prisma.organization.deleteMany({
                where: { 
                    hubspot_id: { in: otherMergedIds },
                }
            });
            

        }catch(error){
            throw new BadRequestException(`HandlerOrganizationMerge: ${error.message}`);
        }


    }
}