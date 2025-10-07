import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { HandlerDealCreation } from "./dealCreation";
import { dealToDbDictionary } from "../../common/dictionaries/deal-dictionary";

@Injectable()

export class HandlerDealPropertyChange {

    constructor(
        private readonly prisma: PrismaService,
        private readonly dealCreation: HandlerDealCreation
       
    ){}

    async execute(event){
        const deal = await this.prisma.staff.findUnique({
            where: {
                hubspot_id: String(event.objectId)
            }
        })

        if(!deal ) return await this.dealCreation.execute(event);


        const fieldExists = Object.keys(dealToDbDictionary).includes(event.propertyName);
        if(!fieldExists) return;

        const fieldUpdated = dealToDbDictionary[event.propertyName];
        let value = event.propertyValue;

        
        await this.prisma.staff.update({
            where: {
                id: deal.id
            },
            data: {
                [fieldUpdated]: value
            }
        })
        
        return true;

    }
}