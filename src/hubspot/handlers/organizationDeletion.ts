import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { OrganizationStatus } from "@prisma/client";

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

            
            await this.prisma.organization.update({
                where: {
                    id: organizationExists.id
                },
                data:{
                    status: OrganizationStatus.inactive
                }
            });
        }catch (error) {
            throw new BadRequestException('Error deleting organization', error);
        }
        
    }
}