import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { OrganizationStatus } from "@prisma/client";
import { getNowInTimezone } from "../../common/utils/formatDate";

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

            await this.prisma.uSER.updateMany({
                where: {
                    organization_id: organizationExists.id
                },
                data:{
                    status: 'inactive'
                }
            })
            
            await this.prisma.organization.update({
                where: {
                    id: organizationExists.id
                },
                data:{
                    status: OrganizationStatus.deleted,
                    deletedAt: getNowInTimezone('UTC')
                }
            });
        }catch (error) {
            throw new BadRequestException('Error deleting organization', error);
        }
        
    }
}