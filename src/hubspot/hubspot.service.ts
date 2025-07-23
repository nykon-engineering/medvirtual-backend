import { BadRequestException, Injectable } from '@nestjs/common';
import { Client } from '@hubspot/api-client'
import { FilterOperatorEnum } from '@hubspot/api-client/lib/codegen/crm/objects';
import axios from 'axios';

import { extractDriveFileId } from '../common/utils/hubspot.util'
import { GoogledriveService } from '../googledrive/googledrive.service';
import { changeDataToHubspotDto } from './dto/change-data-hubspot.dto';
import { GetCandidatesDto } from './dto/get-candidates.dto';


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

    async changeDataFromHubspot(data: any): Promise<any> {
        // Process the webhook data as needed

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




    
    ////=> this service is just a example to read candidates and download resume
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
            const idFile = extractDriveFileId(urlFile);
            //console.log('idFile:', idFile);

            if (idFile) await this.google.downloadFile(idFile, pdfName);

          }
          return response;
      }catch (error) {
          throw new BadRequestException(`Error fetching candidates: ${error.message}`);
      }
    }
}