import { BadRequestException, Injectable } from "@nestjs/common";
import axios from "axios";

import { mapHubspotToDb } from "../../common/utils/hubspot.util";
import { candidadeToDbDictionary } from "../../common/dictionaries/candidate-dictionary";
import { PrismaService } from "../../prisma/prisma.service";
import { CandidatesService } from "../../candidate/candidates.service";


@Injectable()
export class HandlerObjectCreation {
    constructor(
        private readonly prisma: PrismaService,
        private readonly candidateService: CandidatesService
    ){}


    async execute(event){

        const properties = Object.keys(candidadeToDbDictionary).join(',');
        try{
            const getObject = await axios.get(`https://api.hubapi.com/crm/v3/objects/${process.env.HUBSPOT_CUSTOM_OBJECT}/${event.objectId}?properties=language_spoken,${properties}`, 
                {
                    headers: {
                        Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                }
            )
            if (!getObject) {
                throw new BadRequestException('No object data found');
            }

            const candidateData = mapHubspotToDb(getObject.data.properties);//this variable doenst have the language,because languages went setup on dictionary
            candidateData.processing_status='pending';

            const candidateExists = await this.prisma.candidate.findUnique({
                where: {
                    hubspot_id: String(event.objectId)
                }
            })
            if(candidateExists) throw new BadRequestException('Candidate already exists on the database');

            const createCandidate = await this.prisma.candidate.create({
                data: candidateData,
            })
            if (!createCandidate) {
                throw new BadRequestException('Error creating candidate in the database');
            }
            //Here, I start to work with the skills


            //here I start to work with the language
            if (getObject.data.properties.language_spoken) {
                const languageCandidateSpoken = getObject.data.properties.language_spoken.split('&').map((lang: string) => lang.trim());

                for (const language of languageCandidateSpoken) {
                    await this.prisma.candidateLanguage.create({
                        data: {
                            candidate_id: createCandidate.id,
                            name: language
                        }
                    })
                }
            }
            console.log(`Candidate created with ID: ${createCandidate.id}, Name: ${createCandidate.first_name} ${createCandidate.last_name}`);
            // Run the resume pipeline when the candidate is created
            await this.candidateService.processData(createCandidate.id);

            return true;

        }catch (error) {
            throw new BadRequestException(`Error fetching object creation data: ${error.message}`);
        }


    }
}