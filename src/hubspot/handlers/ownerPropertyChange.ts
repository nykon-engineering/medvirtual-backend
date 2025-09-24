import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { HandlerOwnerCreation } from "./ownerCreation";
import { ownerToDbDictionary } from "src/common/dictionaries/owner-dictionary";

@Injectable()

export class HandlerOwnerPropertyChange {

    constructor(
        private readonly prisma: PrismaService,
        private readonly ownerCreation: HandlerOwnerCreation
    ){}

    async execute(event){
        const owner = await this.prisma.uSER.findUnique({
            where: {
                hubspot_id: String(event.objectId)
            }
        })

        if(!owner) return await this.ownerCreation.execute(event);

            const fieldExists = Object.keys(ownerToDbDictionary).includes(event.propertyName);
            if(!fieldExists) return;

            const fieldUpdated = ownerToDbDictionary[event.propertyName];
            
            await this.prisma.uSER.update({
                where: {
                    id: owner.id
                },
                data: {
                    [fieldUpdated]: event.propertyValue
                }
            })
            
            return true;

    }
}