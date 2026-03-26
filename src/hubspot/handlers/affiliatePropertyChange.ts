import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { HandlerAffiliateCreation } from "./affiliateCreation";

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

        // the AffiliateProfile table is a simple table without personal datas;
        // Thats why we can not update this table
        // and doesnt make sense update the user table
        return true;
        

    }
}