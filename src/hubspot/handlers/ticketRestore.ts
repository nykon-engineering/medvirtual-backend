import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class HandlerTicketRestore {
    constructor(
    private readonly prisma: PrismaService
    ){}

    async execute(event){
        try {
            
            const ticketExists = await this.prisma.hireRequest.findUnique({
                where: {
                    hubspot_ticket_id: String(event.objectId),
                    status: 'deleted'
                },
                select: {
                    id: true,
                    old_status: true
                }
            })
            if(!ticketExists) return;

            await this.prisma.hireRequest.update({
                where: {
                    id: ticketExists.id
                },
                data: {
                    status: ticketExists.old_status ?? 'new',
                }
            })

        }catch (error) {
            throw new BadRequestException('Error Restoring ticket', error);
        }
        
    }
}