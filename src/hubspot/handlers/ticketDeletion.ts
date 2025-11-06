import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class HandlerTicketDeletion {
    constructor(
    private readonly prisma: PrismaService
    ){}

    async execute(event){
        try {
            const ticketExists = await this.prisma.hireRequest.findUnique({
                where: {
                    hubspot_ticket_id: String(event.objectId)
                },
                select: {
                    id: true
                }
            })
            if(!ticketExists) return;
            
            await this.prisma.hireRequest.delete({
                where: {
                    id: ticketExists.id
                }
            });
        }catch (error) {
            throw new BadRequestException('Error deleting ticket', error);
        }
        
    }
}