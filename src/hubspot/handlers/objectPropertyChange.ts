import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { candidadeToDbDictionary } from "../../common/dictionaries/candidate-dictionary";
import { HandlerObjectCreation } from "./objectCreation";
import { CandidatesService } from "../../candidate/candidates.service";

@Injectable()

export class HandlerObjectPropertyChange {

    constructor(
        private readonly prisma: PrismaService,
        private readonly objectCreation: HandlerObjectCreation,
        private readonly candidateService: CandidatesService
    ){}

    async execute(event){
        const candidate = await this.prisma.candidate.findUnique({
            where: {
                hubspot_id: String(event.objectId)
            }
        })

        if(!candidate) return await this.objectCreation.execute(event); 

        if(event.propertyName === 'language_spoken'){
            await this.prisma.candidateLanguage.deleteMany({
                where: {
                    candidate_id: candidate.id
                }
            });

            const languages = event.propertyValue.split('&').map((lang: string) => lang.trim());
            for (const language of languages) {
                await this.prisma.candidateLanguage.create({
                    data: {
                        candidate_id: candidate.id,
                        name: language
                    }
                });
            }

            return true;
        }else if(event.propertyName === 'career_highlights_relevant_job_experiences'){
            await this.prisma.candidateSkill.deleteMany({
                where: {
                    candidate_id: candidate.id
                }
            });

            const candidadeSkills = event.propertyValue.split(';').map((skill: string) => skill.trim());
            for (const skill of candidadeSkills) {
                await this.prisma.candidateSkill.create({
                    data: {
                        candidate_id: candidate.id,
                        skill_name: skill,
                        skill_type: undefined, // This field is not used in the current implementation
                    }
                });

        }
        }else{
            
            const fieldUpdated = candidadeToDbDictionary[event.propertyName];
            if (!fieldUpdated) return;

            const fields = Array.isArray(fieldUpdated) ? fieldUpdated : [fieldUpdated];

            const updateData = fields.reduce((acc, field) => {
                if (field === 'approved_positions_pairing') {
                    acc[field] = event.propertyValue
                      ? event.propertyValue.split(';').map((v: string) => v.trim())
                      : [];
                  } else {
                    acc[field] = event.propertyValue;
                  }
            return acc;
            }, {} as Record<string, any>);

            await this.prisma.candidate.update({
            where: { id: candidate.id },
            data: updateData,
            });
            
            /* => removed when we added the pipeline status field
            const fieldExists = Object.keys(candidadeToDbDictionary).includes(event.propertyName);
            if(!fieldExists) return;

            const fieldUpdated = candidadeToDbDictionary[event.propertyName];
            
            await this.prisma.candidate.update({
                where: {
                    id: candidate.id
                },
                data: {
                    [fieldUpdated]: event.propertyValue
                }
            })
            */

            // Re-run the resume pipeline if this chnge is related to the resume
            
                if (process.env.ENVIRONMENT === 'PROD') {
                    if(event.propertyName === 'resume_link') {
                        await this.candidateService.processData(candidate.id);
                    }
                    if(event.propertyName === 'headshot_screenshot') {
                        await this.candidateService.processAvatar(candidate.id);
                    }
                }else{
                    console.log('Environment is not PROD. Skipping re-run of pipelines.');
                }
            
            
            return true;
        }

    }
}