import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class HandlerOrganizationDeletion {
    constructor(
    private readonly prisma: PrismaService
    ){}

    async execute(event){
        try {
            const organizationExists = await this.prisma.organization.findUnique({
                where: {
                    hubspot_id: String(event.objectId)
                },
                select: {
                    id: true
                }
            })
            if(!organizationExists) return;
            
            await this.prisma.organization.delete({
                where: {
                    id: organizationExists.id
                }
            });
        }catch (error) {
            throw new BadRequestException('Error deleting organization', error);
        }
        
    }
}