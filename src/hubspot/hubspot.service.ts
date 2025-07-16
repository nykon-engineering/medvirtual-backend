import { BadRequestException, Injectable } from '@nestjs/common';
import { Client } from '@hubspot/api-client'
import { FilterOperatorEnum } from '@hubspot/api-client/lib/codegen/crm/objects';

@Injectable()
export class HubspotService {

    private hubspotClient: Client;

    constructor() {
        this.hubspotClient = new Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });
    }

    async getCandidates() {
        try{
            const virtualAssistant = "p20630393_Virtual_Assistant";
            const fieldtoSearch = "hs_pipeline";
            const valuetoSearch = '155006239';
            const properties = ['name', 'id', 'agent_status', 'status', 'stage', 'country', 'date_of_birth', 'email', 'resume_link', 'hs_pipeline', 'hs_pipeline_stage']

            const response = await this.hubspotClient.crm.objects.searchApi.doSearch(virtualAssistant,{
                filterGroups: [
                    {
                        filters: [
                            {
                                propertyName: fieldtoSearch,
                                operator: FilterOperatorEnum.Eq,
                                value: valuetoSearch,
                            },
                            {
                                propertyName: 'hs_pipeline_stage',
                                operator: FilterOperatorEnum.Eq,
                                value: '261075105',
                            }
                        ]
                    }
                ],
                properties: properties
            })
            return response;
        }catch (error) {
            throw new BadRequestException(`Error fetching candidates: ${error.message}`);
        }
    }

    


}


/* types found on hubspot | I need to checkout if this status there associations with the stage from hubspot
=> Create a function to get candidates in one specific stage
Active in Ops

Failed Recruitment Screening

Pending Start

For Pairing

Resigned

Withdrawn Application (Pre-Ops)

Terminated (Pre-Ops)

Terminated in Ops

Agent Reliability

Agent Performance

Agent Skills Mismatch

Client Change of Business

Client Non-Payment

Client Out of Budget

*/