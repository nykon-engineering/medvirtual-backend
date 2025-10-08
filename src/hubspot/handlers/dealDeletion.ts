import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class HandlerDealDeletion {
    constructor(
    private readonly prisma: PrismaService
    ){}

    async execute(event){
        //try {
            const staffExists = await this.prisma.staff.findUnique({
                where: {
                    hubspot_id: String(event.objectId)
                },
                select: {
                    id: true
                }
            })
            if(!staffExists) return;
            
            await this.prisma.staff.delete({
                where: {
                    id: staffExists.id
                }
            });
        
        
    }
}