import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";


@Injectable()
export class HandlerObjectDeletion {
    constructor(
    private readonly prisma: PrismaService
    ){}


    async execute(event){
        try {
            const candidateExists = await this.prisma.candidate.findUnique({
                where: {
                    hubspot_id: String(event.objectId)
                }
            })
            if(!candidateExists) return;
    
            //First, delete the candidate skills and languages associated with the candidate
            await this.prisma.candidateSkill.deleteMany({
                where: {
                    candidate_id: candidateExists.id
                }
            });
            await this.prisma.candidateLanguage.deleteMany({
                where: {
                    candidate_id: candidateExists.id
                }
            });
    
            //Then, delete the candidate
            await this.prisma.candidate.delete({
                where: {
                    id: candidateExists.id
                }
            });
        }catch (error) {
            throw new BadRequestException('Error deleting candidate', error);
        }
        
    }
}