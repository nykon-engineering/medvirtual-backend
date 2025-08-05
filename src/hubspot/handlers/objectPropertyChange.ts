import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { candidadeToDbDictionary } from "../../common/dictionaries/candidate-dictionary";
import { HandlerObjectCreation } from "./objectCreation";

@Injectable()

export class HandlerObjectPropertyChange {

    constructor(
        private readonly prisma: PrismaService,
        private readonly objectCreation: HandlerObjectCreation,
    ){

    }

    async execute(event){
        const candidate = await this.prisma.candidate.findUnique({
            where: {
                hubspot_id: String(event.objectId)
            }
        })

        if(!candidate) return await this.objectCreation.execute(event); // here, I need to refactor to allow create a new candidate if its not exists

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
        }else{

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

            return true;
        }

    }
}