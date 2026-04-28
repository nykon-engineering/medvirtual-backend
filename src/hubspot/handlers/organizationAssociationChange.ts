import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { HandlerOrganizationCreation } from "./organizationCreation";
import { HandlerDealCreation } from "./dealCreation";
import { HandlerContactCreation } from "./contactCreation";

@Injectable()

export class HandlerOrganizationAssociationChange {

    constructor(
        private readonly prisma: PrismaService,
        private readonly organizationCreation: HandlerOrganizationCreation,
        private readonly dealCreation: HandlerDealCreation,
        private readonly contactCreation: HandlerContactCreation
    ){}

    async execute(event){

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
        
        switch (event.associationType) {
               
            case 'COMPANY_TO_DEAL':
                //fromObjectId => company/organization
                //toObjectId => deal

               

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
                    const newDeal = await this.dealCreation.execute(eventStaff);
                    if (!newDeal) {
                        console.log('Impossible to create staff from dealCreation handler | Maybe this deal is not in the right pipeline');
                        return;
                    }
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

            
                let contact = await this.prisma.contact.findUnique({
                    where: {
                        hubspot_id: String(event.toObjectId)
                    },
                    select: {
                        id: true,
                    }
                })
                const eventContact = {...event, objectId: event.toObjectId}
                if(!contact) {
                    const newContact = await this.contactCreation.execute(eventContact);
                    if (!newContact) {
                        console.log('Impossible to create contact from contactCreation handler | Maybe this contact is not in the right pipeline');
                        return;
                    }
                } 

                await this.prisma.contact.update({
                    where: {
                        hubspot_id: String(event.toObjectId)
                    },
                    data: {
                        organization_id: organization.id 
                    }
                })
                
            
            break;
        }

       

        return true;
    }
}