import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AffiliateStatus } from "@prisma/client";


@Injectable()
export class HandlerAffiliateDeletion {
    constructor(
    private readonly prisma: PrismaService
    ){}


    async execute(event){
        try {
            const affiliateExists = await this.prisma.affiliateProfile.findUnique({
                where: {
                    hubspot_id: String(event.objectId)
                }
            })
            if(!affiliateExists) return;
    
            //Then, delete the candidate
            await this.prisma.affiliateProfile.update({
                where: {
                    id: affiliateExists.id
                },
                data: {
                    status: AffiliateStatus.inactive,
                }
            });
        }catch (error) {
            throw new BadRequestException('Error deleting affiliate', error);
        }
        
    }
}