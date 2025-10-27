import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { HandlerOrganizationCreation } from "./organizationCreation";
import { organizationToDbDictionary } from "../../common/dictionaries/organization-dictionary";
import { HandlerOrganizationDeletion } from "./organizationDeletion";
import { OrganizationRole } from "@prisma/client";
import { organizationIndustryToDbDictionary } from "../../common/dictionaries/organizationIndustry-dictionary";

@Injectable()

export class HandlerOrganizationPropertyChange {

    constructor(
        private readonly prisma: PrismaService,
        private readonly organizationCreation: HandlerOrganizationCreation,
        private readonly organizationDeletion: HandlerOrganizationDeletion
    ){}

    async execute(event){
        const organization = await this.prisma.organization.findUnique({
            where: {
                hubspot_id: String(event.objectId)
            }
        })

        //Here I dont need to check if the organization is a client of MedVirtual, because inside the organizationCreation handler it already does that
        if(!organization ) return await this.organizationCreation.execute(event);

        //Here I need to delete the organization if the business_unit property is changed to a value different than MedVirtual
        if(organization && event.propertyName === 'business_unit' && event.propertyValue !== 'MedVirtual') return await this.organizationDeletion.execute(event);

            const fieldExists = Object.keys(organizationToDbDictionary).includes(event.propertyName);
            if(!fieldExists) return;

            const fieldUpdated = organizationToDbDictionary[event.propertyName];
            let value = event.propertyValue;

            if (fieldUpdated === 'organization_role') {
                if (event.propertyValue.toLowerCase() === 'prospect'){
                    value = OrganizationRole.prospect;
                }else{
                    value = OrganizationRole.client;
                }
            }

            if (fieldUpdated === 'industry') {
                value = event.propertyValue ? (organizationIndustryToDbDictionary[event.propertyValue] ?? '') : '';
            }

            if (fieldUpdated === 'specialties') {
                value = event.propertyValue
                  ?.split(',')
                  .map((item: string) => item.trim())
                  .filter((item: string) => item.length > 0);
            }

            if (fieldUpdated === 'number_of_employees') {
                value = event.propertyValue ? Number(event.propertyValue) : null;
            }
            
            await this.prisma.organization.update({
                where: {
                    id: organization.id
                },
                data: {
                    [fieldUpdated]: value
                }
            })
            
            return true;

    }
}