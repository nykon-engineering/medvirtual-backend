import { BadRequestException, Injectable } from '@nestjs/common';
import { Client } from '@hubspot/api-client'
import { FilterOperatorEnum } from '@hubspot/api-client/lib/codegen/crm/objects';
import { GetCandidatesDto } from './dto/get-candidates.dto';

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { GoogledriveService } from '../googledrive/googledrive.service';


@Injectable()
export class HubspotService {

    private hubspotClient: Client;
    

    constructor(
      private readonly google: GoogledriveService
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

    async extractDriveFileId(url: string): Promise<string | null> {
      const match = url.match(/\/d\/([a-zA-Z0-9_-]{25,})/);
      return match ? match[1] : null;
    }
    


    
    //Here I have a test fucntion to get resume_link from hubspot and download it from Google Drive using my own GoogleDriveService
    async getCandidates2(data: GetCandidatesDto): Promise<any> {
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
            const idFile = await this.extractDriveFileId(urlFile);
            //console.log('idFile:', idFile);

            if (idFile) await this.google.downloadFile(idFile, pdfName);

          }
          return response;
      }catch (error) {
          throw new BadRequestException(`Error fetching candidates: ${error.message}`);
      }
    }
}