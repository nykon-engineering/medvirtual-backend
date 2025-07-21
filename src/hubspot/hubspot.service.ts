import { BadRequestException, Injectable } from '@nestjs/common';
import { Client } from '@hubspot/api-client'
import { FilterOperatorEnum } from '@hubspot/api-client/lib/codegen/crm/objects';
import { GetCandidatesDto } from './dto/get-candidates.dto';

import * as fs from 'fs';
import * as path from 'path';


@Injectable()
export class HubspotService {

    private hubspotClient: Client;

    constructor() {
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


    async downloadFile(fileUrl: string, fileName: string): Promise<string> {
        const localPath = path.resolve(__dirname, '..', '..', 'downloads', fileName);
    
        // Garante que o diretório exista
        const dir = path.dirname(localPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
    
        let response;
        try {
          response = await fetch(fileUrl);
        } catch (err) {
          throw new BadRequestException(`Erro ao fazer requisição: ${err.message}`);
        }
    
        if (!response.ok) {
          throw new BadRequestException(`Falha ao baixar arquivo: ${response.statusText}`);
        }
    
        if (!response.body) {
          throw new BadRequestException('Resposta sem corpo (response.body é null).');
        }
    
        const fileStream = fs.createWriteStream(localPath);
    
        return new Promise((resolve, reject) => {
          response.body.pipe(fileStream);
          response.body.on('error', (err) => reject(new BadRequestException(err.message)));
          fileStream.on('finish', () => resolve(localPath));
        });
      }
    

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
                properties: data.properties
            })
            if (!response || !response.results || response.results.length === 0) {
                throw new BadRequestException('No candidates found');
            }
            for (let i=0; i<= response.results.length ; i++){
               //this.downloadFile(response.results[i].properties.resume, response.results[i].properties.name + '.pdf')
            }
        }catch (error) {
            throw new BadRequestException(`Error fetching candidates`);
        }
    }
}