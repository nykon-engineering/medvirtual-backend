import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { HandlerOrganizationCreation } from "./organizationCreation";
import { organizationToDbDictionary } from "../../common/dictionaries/organization-dictionary";

@Injectable()

export class HandlerOrganizationPropertyChange {

    constructor(
        private readonly prisma: PrismaService,
        private readonly organizationCreation: HandlerOrganizationCreation,
    ){}

    async execute(event){
        const organization = await this.prisma.organization.findUnique({
            where: {
                hubspot_id: String(event.objectId)
            }
        })
        console.log('Organization Property Change Event:', event);
        console.log('Matched Organization:', organization);

        if(!organization) return await this.organizationCreation.execute(event);

            const fieldExists = Object.keys(organizationToDbDictionary).includes(event.propertyName);
            if(!fieldExists) return;

            const fieldUpdated = organizationToDbDictionary[event.propertyName];
            
            await this.prisma.organization.update({
                where: {
                    id: organization.id
                },
                data: {
                    [fieldUpdated]: event.propertyValue
                }
            })
            
            return true;

    }
}