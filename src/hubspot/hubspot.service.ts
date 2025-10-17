import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Client } from '@hubspot/api-client'
import { FilterOperatorEnum } from '@hubspot/api-client/lib/codegen/crm/objects';
import axios from 'axios';
import { Prisma } from '@prisma/client';

import {  mapHubspotToDb } from '../common/utils/hubspot.util'
import { candidadeToDbDictionary } from '../common/dictionaries/candidate-dictionary';

import { CandidatesService } from '../candidate/candidates.service';

import { changeDataToHubspotDto } from './dto/change-data-hubspot.dto';
import { GetCandidatesDto } from './dto/get-candidates.dto';
import { PrismaService } from '../prisma/prisma.service';

import { HandlerObjectCreation } from './handlers/objectCreation';
import { HandlerObjectPropertyChange } from './handlers/objectPropertyChange';
import { HandlerObjectDeletion } from './handlers/objectDeletion';
import { HandlerOrganizationCreation } from './handlers/organizationCreation';
import { HandlerOrganizationPropertyChange } from './handlers/organizationPropertyChange';
import { HandlerOrganizationDeletion } from './handlers/organizationDeletion';
import { HandlerOrganizationAssociationChange } from './handlers/organizationAssociationChange';
import { HandlerOwnerCreation } from './handlers/ownerCreation';
import { HandlerOwnerDeletion } from './handlers/ownerDeletion';
import { HandlerOwnerPropertyChange } from './handlers/ownerPropertyChange';
import { HandlerDealCreation } from './handlers/dealCreation';
import { HandlerDealPropertyChange } from './handlers/dealPropertyChange';
import { HandlerDealDeletion } from './handlers/dealDeletion';
import { HandlerDealAssociationChange } from './handlers/dealAssociationChange';




@Injectable()
export class HubspotService {

    private hubspotClient: Client;
    constructor(
      private readonly prisma: PrismaService,
      private readonly objectCreation: HandlerObjectCreation,
      private readonly objectPropertyChange: HandlerObjectPropertyChange,
      private readonly objectDeletion: HandlerObjectDeletion,
      private readonly organizationCreation: HandlerOrganizationCreation,
      private readonly organizationPropertyChange: HandlerOrganizationPropertyChange,
      private readonly organizationDeletion : HandlerOrganizationDeletion,
      private readonly organizationAssociationChange: HandlerOrganizationAssociationChange,

      private readonly dealCreation: HandlerDealCreation,
      private readonly dealPropertyChange: HandlerDealPropertyChange,
      private readonly dealDeletion: HandlerDealDeletion,
      private readonly dealAssociationChange: HandlerDealAssociationChange,

      //private readonly ownerCreation: HandlerOwnerCreation,
      //private readonly ownerDeletion: HandlerOwnerDeletion,
      //private readonly ownerPropertyChange: HandlerOwnerPropertyChange,
      @Inject(forwardRef (() => CandidatesService))
      private readonly candidate: CandidatesService
    ) {
        this.hubspotClient = new Client({ 
            accessToken: process.env.HUBSPOT_ACCESS_TOKEN,
        });
    }

    async getCandidates(data: GetCandidatesDto): Promise<any> {
        if (!data.virtualAssistant) throw new BadRequestException('Virtual Assistant identifier is required');
        try{
            const response = await this.hubspotClient.crm.objects.searchApi.doSearch(data.virtualAssistant,{
                filterGroups: [
                    {
                        filters: (data.filters ?? []).map(item => ({
                            propertyName: item.field,
                            operator: FilterOperatorEnum.Eq,
                            value: item.value
                          }))
                    }
                ],
                properties: data.properties
            })

            return response;
        }catch (error) {
            throw new BadRequestException(`Error fetching candidates`);
        }
    }

    async changeDataFromHubspot(data: any): Promise<any> {
        let orderedData: any[] = [];
        console.log('Received data:', data);

        if (!data || data.length >= 2) {
            orderedData = data.sort((a,b)=>{
                if (a.subscriptionType < b.subscriptionType) return -1;
                if (a.subscriptionType > b.subscriptionType) return 1;
                return 0;
            })
        }else{
            orderedData = data;
        }
    
        //console.log('Ordered Data:', orderedData);

        for (const event of orderedData){
            switch (event.subscriptionType) {
               
                case 'object.creation':
                case 'object.restore':
                    await this.objectCreation.execute(event);
                    break;
                case 'object.propertyChange':
                    await this.objectPropertyChange.execute(event);
                    break;

                case 'object.deletion':
                    await this.objectDeletion.execute(event);
                    break;

                /*
                case 'owners.creation':
                case 'owners.restore':
                case 'contact.creation':
                case 'contact.restore':
                    await this.ownerCreation.execute(event);
                    break;

                case 'owners.deletion':
                case 'contact.deletion':
                    await this.ownerDeletion.execute(event);
                    break;

                case 'owners.propertyChange':
                case 'contact.propertyChange':
                    await this.ownerPropertyChange.execute(event);
                    break;
                */
                case 'company.creation':
                case 'company.restore':
                    await this.organizationCreation.execute(event);
                    break;

                case 'company.propertyChange':
                    await this.organizationPropertyChange.execute(event);
                    break;
                
                case 'company.deletion':
                    await this.organizationDeletion.execute(event);
                    break;

                case 'company.associationChange': 
                    await this.organizationAssociationChange.execute(event);
                    break;
                
                case 'deal.creation':
                case 'deal.restore':
                    await this.dealCreation.execute(event);
                    break;

                case 'deal.propertyChange':
                    await this.dealPropertyChange.execute(event);
                    break;

                case 'deal.deletion':
                    await this.dealDeletion.execute(event);
                    break;

                case 'deal.associationChange':
                    await this.dealAssociationChange.execute(event);
                    break;
                /*
                [{
                    eventId: 872635545,
                    subscriptionId: 4328151,
                    portalId: 20630393,
                    appId: 17008354,
                    occurredAt: 1758637869029,
                    subscriptionType: 'company.associationChange',
                    attemptNumber: 0,
                    changeSource: 'USER',
                    associationType: 'COMPANY_TO_DEAL', //COMPANY_TO_CONTACT
                    fromObjectId: 39895238437,
                    toObjectId: 44166736144,
                    associationRemoved: false,
                    isPrimaryAssociation: false,
                    sourceId: 'userId:69965733'
                }]
                */
            }
        }

        
    }

    async changeDataToHubspot(objectId: string, data: changeDataToHubspotDto): Promise<boolean> {
        if(!objectId) throw new BadRequestException('Object ID is required');

        const body = {
            properties: data.properties.reduce((acc: any, item: any) => {
                acc[item.field] = item.value;
                return acc;
            }, {})
        }
        try{
            const response = await axios.patch(`https://api.hubapi.com/crm/v3/objects/${process.env.HUBSPOT_CUSTOM_OBJECT}/${objectId}`,
                body,
                {
                    headers: {
                        Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                }
            )
            return true;
        }catch (error) {
            throw new BadRequestException(`Error updating data in HubSpot: ${error.message}`);
        }
    }

    async updateManyCandidatesFromHireRequest(candidates, pipelineStatus): Promise<boolean> {
        try{
            if (!process.env.HUBSPOT_CUSTOM_OBJECT) throw new NotFoundException('Custom Object is not defined on the environment variables');
            await this.hubspotClient.crm.objects.batchApi.update(process.env.HUBSPOT_CUSTOM_OBJECT,
                {
                  inputs: candidates.map(c => ({
                    id: c.hubspot_id,
                    properties: {
                      hs_pipeline_stage: pipelineStatus,
                    },
                  })),
                }
              );
              return true;
        }catch (error) {
            throw new BadRequestException(`Error updating data in HubSpot: ${error.message}`);
        }
    }

    async updateOneCandidateFromHireRequest(hubspot_id: string, pipelineStatus: string): Promise<boolean> {
        console.log('Updating candidate in HubSpot with ID:', hubspot_id, 'to pipeline status:', pipelineStatus);
        try{
            if (!process.env.HUBSPOT_CUSTOM_OBJECT) throw new NotFoundException('Custom Object is not defined on the environment variables');
            
            const updateBody = {
                properties: {
                    hs_pipeline_stage: pipelineStatus,
                },
            };

            await this.hubspotClient.crm.objects.basicApi.update(
                process.env.HUBSPOT_CUSTOM_OBJECT,
                hubspot_id,
                updateBody, 
            );
            return true;
        }catch (error) {
            throw new BadRequestException(`Error updating data in HubSpot: ${error.message}`);
        }
    }


    ////=> this service is just a example to read candidates on our database and CREATE it with the data from hubspot
    async createCandidates(pipeline_stage: string): Promise<string> {
        const virtualAssistant ='p20630393_Virtual_Assistant';
        const properties = Object.keys(candidadeToDbDictionary).join(',')+',career_highlights_relevant_job_experiences,language_spoken';

        const response = await this.hubspotClient.crm.objects.searchApi.doSearch(virtualAssistant,{
            filterGroups: [
                {
                    filters: [
                        {
                            propertyName: 'hs_pipeline_stage',
                            operator: FilterOperatorEnum.Eq,
                            value: pipeline_stage ? pipeline_stage : '99999999' // Default value if not provided
                        }
                    ]
                }
            ],
            properties: properties.split(','),
            limit: 100
            })
        if (!response || !response.results || response.results.length === 0) {
            throw new BadRequestException('No candidates data found');
        }

        console.log('Candidates found in Hubspot:', response.total);

        for (const result of response.results) {


            const user = await this.prisma.candidate.findUnique({
                where: {
                    hubspot_id: String(result.properties.hs_object_id),
                    pipeline_status: pipeline_stage ? pipeline_stage : '99999999'
                }
            })
            

            
            if (!user){
                console.log('Candidate found in Hubspot and not found on database:', result.properties.name, result.properties.hs_object_id);
                const candidateData = mapHubspotToDb(result.properties);

                if (candidateData.approved_positions_pairing && typeof candidateData.approved_positions_pairing === 'string') {
                    candidateData.approved_positions_pairing = (candidateData.approved_positions_pairing as string)
                    .split(';')
                    .map(s => s.trim());
                } else {
                    candidateData.approved_positions_pairing = [];
                }
                const newCandidate = await this.prisma.candidate.create({
                    data: candidateData,
                })

                //Here, I start to work with the skills
                if (result.properties.career_highlights_relevant_job_experiences) {
                    const candidadeSkills = result.properties.career_highlights_relevant_job_experiences.split(';').map((skill: string) => skill.trim());

                    for (const skill of candidadeSkills) {
                        await this.prisma.candidateSkill.create({
                            data: {
                                candidate_id: newCandidate.id,
                                skill_name: skill,
                                skill_type: undefined,// This field is not used in the current implementation
                            }
                        })
                    }
                }

                //here I start to work with the language
                if (result.properties.language_spoken) {
                    const languageCandidateSpoken = result.properties.language_spoken.split('&').map((lang: string) => lang.trim());

                    for (const language of languageCandidateSpoken) {
                        await this.prisma.candidateLanguage.create({
                            data: {
                                candidate_id: newCandidate.id,
                                name: language
                            }
                        })
                    }
                }
                console.log('Candidate created:', result.properties.name);
            }
            
        }
        return 'Candidates created successfully';
    }
    
    ////=> this service is just a example to read candidates on our database and UPDATE it with the data from hubspot
    async updateCandidates(pipeline_stage: string): Promise<any> {
        const virtualAssistant ='p20630393_Virtual_Assistant';
        const properties = Object.keys(candidadeToDbDictionary).join(',')+',career_highlights_relevant_job_experiences,language_spoken';

        const candidates = await this.prisma.candidate.findMany({
            where: {
                pipeline_status: pipeline_stage ? pipeline_stage : undefined,
            },
            orderBy:{
                createdAt: 'desc'
            },
            select:{
                id: true,
                first_name: true,
                resume_url: true,
                hubspot_id: true,
            }
        })
       // console.log('Candidates to process:', candidates);

        for (const candidate of candidates){

            const response = await this.hubspotClient.crm.objects.searchApi.doSearch(virtualAssistant,{
            filterGroups: [
                {
                    filters: [
                        {
                            propertyName: 'hs_object_id',
                            operator: FilterOperatorEnum.Eq,
                            value: candidate.hubspot_id
                        }
                    ]
                }
            ],
            properties: properties.split(','),
            limit: 100
            })
            if (!response || !response.results || response.results.length === 0) {
                //throw new BadRequestException('No candidates data found');
                console.log('No candidate data found in Hubspot for candidate ID:', candidate.id, 'with Hubspot ID:', candidate.hubspot_id);
                continue;
            }

            const hubspotProps = response.results[0].properties;
            console.log('Candidate found in Hubspot:', hubspotProps.name);

            


            const candidateData : Prisma.CandidateUpdateInput = mapHubspotToDb(hubspotProps);

            if (candidateData.approved_positions_pairing) {
                candidateData.approved_positions_pairing = (candidateData.approved_positions_pairing as string)
                .split(';')
                .map(s => s.trim())
                .filter(Boolean);
            }else {
                candidateData.approved_positions_pairing = []; 
              }
              
            
            await this.prisma.candidate.update({
                where: {
                    id: candidate.id
                },
                data: candidateData
            })

            console.log('Candidate updated:', response.results[0]);
            //Here, I start to work with the skills
            if (hubspotProps.career_highlights_relevant_job_experiences) {
                await this.prisma.candidateSkill.deleteMany({
                    where: {
                        candidate_id: candidate.id
                    }
                });
                const candidadeSkills = hubspotProps.career_highlights_relevant_job_experiences.split(';').map((skill: string) => skill.trim());

                for (const skill of candidadeSkills) {
                    console.log('Skill to add:', skill);
                    await this.prisma.candidateSkill.create({
                        data: {
                            candidate_id: candidate.id,
                            skill_name: skill,
                            skill_type: undefined,// This field is not used in the current implementation
                        }
                    })
                }
            }

            //here I start to work with the language
            if (hubspotProps.language_spoken) {
                await this.prisma.candidateLanguage.deleteMany({
                    where: {
                        candidate_id: candidate.id
                    }
                });
                const languageCandidateSpoken = hubspotProps.language_spoken.split('&').map((lang: string) => lang.trim());

                for (const language of languageCandidateSpoken) {
                    await this.prisma.candidateLanguage.create({
                        data: {
                            candidate_id: candidate.id,
                            name: language
                        }
                    })
                }
            }
            console.log('Candidate updated:', candidate.first_name);
  
        }
    }


    ////=> this service is just a example to populate our database
    async getCandidatesAndDownload(data: GetCandidatesDto): Promise<any> {
      if (!data.virtualAssistant) throw new BadRequestException('Virtual Assistant identifier is required');
      try{
            const response = await this.hubspotClient.crm.objects.searchApi.doSearch(data.virtualAssistant,{
              filterGroups: [
                  {
                      filters: (data.filters ?? []).map(item => ({
                          propertyName: item.field,
                          operator: FilterOperatorEnum.Eq,
                          value: item.value
                        }))
                  }
              ],
              properties: data.properties,
              limit: 100
            })
            if (!response || !response.results || response.results.length === 0) {
              throw new BadRequestException('No candidates found');
            }


          for (let i=0; i< response.results.length ; i++){
            const candidateData = mapHubspotToDb(response.results[i].properties);
            
            //=> function to populate db with the datas from hubspot
            const candidate = await this.prisma.candidate.findUnique({
                where: {
                    hubspot_id: String(response.results[i].properties.hs_object_id),
                    NOT: {
                        processing_status: 'completed'
                    }
                },
                select: {
                    id: true,
                    processing_status: true,
                    first_name: true,
                    resume_url: true,
                }   
            })
            console.log('Candidate found:', candidate?.first_name , 'on the stage:', candidate?.processing_status);

            if (candidate && candidate.processing_status !== 'completed' && candidate.resume_url?.includes('http')){
                
                await this.prisma.candidate.update({
                    where: {
                        id: candidate.id
                    },
                    data: candidateData
                })
                console.log('Candidate updated:', candidate.first_name);
                if (process.env.ENVIRONMENT === 'PROD') {
                    await this.candidate.processData(candidate.id)
                    console.log('Candidate processed:', candidate.first_name);
                }else{
                    console.log('Environment is not PROD. Skipping processing for candidate:', candidate.first_name);
                }

            }
            
                
            
            

          }
          
          return response;
      }catch (error) {
          throw new BadRequestException(`Error fetching candidates: ${error.message}`);
      }
    }
}