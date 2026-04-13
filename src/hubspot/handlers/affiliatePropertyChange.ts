import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { HandlerAffiliateCreation } from "./affiliateCreation";
import { affiliateToDbDictionary } from "../../common/dictionaries/affiliate-dictionary";

@Injectable()

export class HandlerAffiliatePropertyChange {

    constructor(
        private readonly prisma: PrismaService,
        private readonly affiliateCreation: HandlerAffiliateCreation,
    ){}

    async execute(event){


        const existingAffiliate = await this.prisma.affiliateProfile.findUnique({
            where: {
                hubspot_id: String(event.objectId)
            }
        })

        if(!existingAffiliate) return await this.affiliateCreation.execute(event); 

        const fieldExists = Object.keys(affiliateToDbDictionary).includes(event.propertyName);
        if(!fieldExists) return;

        const fieldUpdated = affiliateToDbDictionary[event.propertyName];

        if (event.propertyName === 'earning_status'){
            //if status = active, set to active, else set to inactive
            event.propertyValue = event.propertyValue === 'active' ? 'active' : 'inactive';
        }
        
        await this.prisma.affiliateProfile.update({
            where: {
                id: existingAffiliate.id
            },
            data: {
                [fieldUpdated]: event.propertyValue
            }
        })

        if(event.propertyName === 'earning_status') {
            const user = await this.prisma.uSER.findFirst({
                where: {
                    affiliateProfile: {
                        hubspot_id: String(event.objectId)
                    }
                },
                select: {
                    id: true,
                    role: true,
                }
            })

            if (user?.role === 'affiliate') {
                await this.prisma.uSER.update({
                    where: {
                        id: user.id
                    },
                    data: {
                        status: event.propertyValue === 'active' ? 'active' : 'inactive'
                    }
                })
            }
        }
        
        return true;
        

    }
}