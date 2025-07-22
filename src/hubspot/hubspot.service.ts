import { BadRequestException, Injectable } from '@nestjs/common';
import { Client } from '@hubspot/api-client'
import { FilterOperatorEnum } from '@hubspot/api-client/lib/codegen/crm/objects';
import { GetCandidatesDto } from './dto/get-candidates.dto';

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { GoogledriveService } from '../googledrive/googledrive.service';
import { console } from 'inspector';


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
    
    async webhook(data: any): Promise<any> {
        // Process the webhook data as needed
        console.log('Webhook received:', data);

        if (data.subscriptionType === 'object.propertyChange'){
            console.log('=====>Property change detected:', data);
            /*
                patch in database just propertychanged in 'propertyName' and 'propertyValue'

                the enpoint to get more details about this candidate is: https://api.hubapi.com/crm/v3/objects/p20630393_Virtual_Assistant/${objectId}  or call our own endpoint : https://gqwni79cgk.execute-api.us-east-1.amazonaws.com/dev/hubspot/candidates

                we need to check the database schema.:
                   processing_status = hs_pipeline_stage (each stage ther a differente number [
                   942502182 - New candidates
                   1119641993 - Incomplete Information
                   1119641994 - Follow Up candidates
                   966446725 - For account Manager Interview
                   261075105 - Available Candidates
                   1087596819 - Available Candidates - Part Time
                   1087596820 - Endorsed to Client - Part Time
                   261137285 - Endorsed to Client
                   261173426 - Pairing booked
                   261214844 - hired
                   261173427 - For endorsement to VS
                   261173428 - Lost

                   ] )
            */
            
        }
        return { status: 'success', message: 'Webhook processed successfully' };
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