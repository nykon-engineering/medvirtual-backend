import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Client } from '@hubspot/api-client'
import { FilterOperatorEnum } from '@hubspot/api-client/lib/codegen/crm/objects';
import axios from 'axios';
import * as path from 'path';

import { extractDriveFileId, mapHubspotToDb } from '../common/utils/hubspot.util'
import { candidadeToDbDictionary } from '../common/dictionaries/candidate-dictionary';
import { changeDataToHubspotDto } from './dto/change-data-hubspot.dto';
import { GetCandidatesDto } from './dto/get-candidates.dto';
import { PrismaService } from '../prisma/prisma.service';
import { GoogledriveService } from '../googledrive/googledrive.service';
import { HandlerObjectCreation } from './handlers/objectCreation';
import { HandlerObjectPropertyChange } from './handlers/objectPropertyChange';
import { CandidatesService } from '../candidate/candidates.service';
import { map } from '@hubspot/api-client/lib/codegen/automation/actions/rxjsStub';


@Injectable()
export class HubspotService {

    private hubspotClient: Client;
    constructor(
      private readonly prisma: PrismaService,
      private readonly objectCreation: HandlerObjectCreation,
      private readonly objectPropertyChange: HandlerObjectPropertyChange,
      private readonly candidate: CandidatesService
    ) {
        this.hubspotClient = new Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });
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
                case 'object.propertyChange':
                    return await this.objectPropertyChange.execute(event);
                case 'object.creation':
                    return await this.objectCreation.execute(event);
                case 'object.deletion':
    
    
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




    ////=> this service is just a example to read candidates on our database and update it with the data from hubspot
    async createCandidates(pipeline_stage: string): Promise<string> {
        const virtualAssistant ='p20630393_Virtual_Assistant';
        const properties = Object.keys(candidadeToDbDictionary).join(',');

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

        //console.log('Candidates found in Hubspot:', response.results);

        for (const result of response.results) {

            const user = await this.prisma.candidate.findUnique({
                where: {
                    hubspot_id: String(result.properties.hs_object_id)
                }
            })

            if (!user){
                const candidateData = mapHubspotToDb(result.properties);
                await this.prisma.candidate.create({
                    data: candidateData,
                })
                console.log('Candidate created:', result.properties.name);
            }
        }
        return 'Candidates created successfully';
    }




    
    ////=> this service is just a example to read candidates on our database and update it with the data from hubspot
    async updateCandidates(pipeline_stage: string): Promise<any> {
        const virtualAssistant ='p20630393_Virtual_Assistant';
        const properties = Object.keys(candidadeToDbDictionary).join(',');

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
                throw new BadRequestException('No candidates data found');
            }
            console.log('Candidate found in Hubspot:', response.results[0].properties.name);
            const candidateData = mapHubspotToDb(response.results[0].properties);
            
            await this.prisma.candidate.update({
                where: {
                    id: candidate.id
                },
                data: candidateData
            })
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

                await this.candidate.processData(candidate.id)
                console.log('Candidate processed:', candidate.first_name);

            }
            
                
            
            

          }
          
          return response;
      }catch (error) {
          throw new BadRequestException(`Error fetching candidates: ${error.message}`);
      }
    }
}