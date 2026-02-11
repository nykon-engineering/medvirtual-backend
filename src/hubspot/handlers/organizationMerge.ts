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
            await this.prisma.$transaction(async (tx) => {
                const primaryOrganization = await tx.organization.findUnique({
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

                
                const mergedCompanies = await tx.organization.findMany({
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
                    await tx.organization.update({
                        where: { hubspot_id: String(event.primaryObjectId) },
                        data: dataToUpdate
                    });
                }

                await tx.organization.update({
                    where: { hubspot_id: String(event.primaryObjectId) },
                    data: {
                        hubspot_id: String(event.newObjectId)
                    }
                });

                for (const merged of mergedCompanies) {
                    //update staffs from merged companies to primary company
                    await tx.staff.updateMany({
                        where: { organization_id: merged.id },
                        data: { 
                            organization_id: primaryOrganization.id,
                            hubspot_organization_id: String(event.newObjectId)
                        }
                    });

                    //update candidates from merged companies to primary company
                    await tx.candidate.updateMany({
                        where: { organization_id: merged.id },
                        data: { organization_id: primaryOrganization.id }
                    });

                    //update users from merged companies to primary company
                    await tx.uSER.updateMany({
                        where: { organization_id: merged.id },
                        data: { 
                            organization_id: primaryOrganization.id,
                            organization_name: primaryOrganization.name,
                        }
                    });

                    //update hire requests from merged companies to primary company
                    await tx.hireRequest.updateMany({
                        where: { org_id: merged.id },
                        data: { org_id: primaryOrganization.id }
                    });
                }
                

                await tx.organization.deleteMany({
                    where: { 
                        hubspot_id: { in: otherMergedIds },
                    }
                });
            });

        }catch(error){
            throw new BadRequestException(`HandlerOrganizationMerge: ${error.message}`);
        }


    }
}