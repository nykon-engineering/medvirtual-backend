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
        
        await this.prisma.affiliateProfile.update({
            where: {
                id: existingAffiliate.id
            },
            data: {
                [fieldUpdated]: event.propertyValue
            }
        })
        
        return true;
        

    }
}