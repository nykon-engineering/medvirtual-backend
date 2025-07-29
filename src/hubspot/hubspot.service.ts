import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Client } from '@hubspot/api-client'
import { FilterOperatorEnum } from '@hubspot/api-client/lib/codegen/crm/objects';
import axios from 'axios';

import { extractDriveFileId, mapHubspotToDb } from '../common/utils/hubspot.util'
import { candidadeToDbDictionary } from '../common/dictionaries/candidate-dictionary';
import { GoogledriveService } from '../googledrive/googledrive.service';
import { changeDataToHubspotDto } from './dto/change-data-hubspot.dto';
import { GetCandidatesDto } from './dto/get-candidates.dto';
import { PrismaService } from '../prisma/prisma.service';


@Injectable()
export class HubspotService {

    private hubspotClient: Client;
    constructor(
      private readonly google: GoogledriveService,
      private readonly prisma: PrismaService
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
        //console.log('Received data:', data);
        const orderedData = data.sort((a,b)=>{
            if (a.subscriptionType < b.subscriptionType) return -1;
            if (a.subscriptionType > b.subscriptionType) return 1;
            return 0;
        })

        //console.log('Ordered Data:', orderedData);

        for (const event of orderedData){
            switch (event.subscriptionType) {
                case 'object.propertyChange':
                    
                    const candidate = await this.prisma.candidate.findUnique({
                        where: {
                            hubspot_id: String(event.objectId)
                        }
                    })
    
                    if(!candidate) return; // here, I need to refactor to allow create a new candidate if its not exists

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
    
                case 'object.creation':
                    const properties = Object.keys(candidadeToDbDictionary).join(',');
                    try{
                        const getObject = await axios.get(`https://api.hubapi.com/crm/v3/objects/${process.env.HUBSPOT_CUSTOM_OBJECT}/${event.objectId}?properties=${properties}`, 
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
                        const candidateData = mapHubspotToDb(getObject.data.properties);
    
                        const createCandidate = await this.prisma.candidate.create({
                            data: candidateData,
                        })
    
                        if (!createCandidate) {
                            throw new BadRequestException('Error creating candidate in the database');
                        }
    
    
                        return true;
    
                    }catch (error) {
                        throw new BadRequestException(`Error fetching object creation data: ${error.message}`);
                    }
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




    
    ////=> this service is just a example to read candidates and download resume OR populate our database
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
            const pdfName = `${response.results[i].properties.name}.pdf`;
            const urlFile = response.results[i].properties.resume_link || '';
            
            
            /* => function to populate db with the datas from hubspot
            const candidateData = mapHubspotToDb(response.results[i].properties);
            const userReady = await this.prisma.candidate.findUnique({
                where: {
                    hubspot_id: String(response.results[i].properties.hs_object_id)
                }
            })
            if(!userReady){
                console.log('Name:', candidateData);
                
                const createCandidate = await this.prisma.candidate.create({
                    data: candidateData,
                })
                console.log('=> Candidate created:', createCandidate.first_name);
            }else{
                console.log('===> Candidate already exists:', response.results[i].properties.name);
            }
            */
            
            /*
            const idFile = extractDriveFileId(urlFile);
            console.log('idFile:', idFile);
            if (idFile) await this.google.downloadFile(idFile, pdfName);
            */

          }
          return response;
      }catch (error) {
          throw new BadRequestException(`Error fetching candidates: ${error.message}`);
      }
    }
}