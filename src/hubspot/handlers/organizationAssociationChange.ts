import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { HandlerOrganizationCreation } from "./organizationCreation";
import { HandlerDealCreation } from "./dealCreation";

@Injectable()

export class HandlerOrganizationAssociationChange {

    constructor(
        private readonly prisma: PrismaService,
        private readonly organizationCreation: HandlerOrganizationCreation,
        private readonly dealCreation: HandlerDealCreation,
    ){}

    async execute(event){
        
        switch (event.associationType) {
               
            case 'COMPANY_TO_DEAL':
                //fromObjectId => company/organization
                //toObjectId => deal

                let organization = await this.prisma.organization.findUnique({
                    where: {
                        hubspot_id: String(event.fromObjectId)
                    },select: {
                        id: true,
                    }
                })

                //If the organization is not found, we create it
                if(!organization )  {
                    await this.organizationCreation.execute(event);
                    organization = await this.prisma.organization.findUnique({
                        where: {
                            hubspot_id: String(event.fromObjectId)
                        },select: {
                            id: true,
                        }
                    })
                }
                if(!organization) return;

                let staff = await this.prisma.staff.findUnique({
                    where: {
                        hubspot_id: String(event.toObjectId)
                    },
                    select: {
                        id: true,
                    }
                })
                const eventStaff = {...event, objectId: event.toObjectId}
                if(!staff) {
                    await this.dealCreation.execute(eventStaff);
                } 

                await this.prisma.staff.update({
                    where: {
                        hubspot_id: String(event.toObjectId)
                    },
                    data: {
                        hubspot_organization_id: String(event.fromObjectId),
                        organization_id: organization.id 
                    }
                })


                break;
            case 'COMPANY_TO_CONTACT':
            
                break;
        }

       

        return true;
    }
}