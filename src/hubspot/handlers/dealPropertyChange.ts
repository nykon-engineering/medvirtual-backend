import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { HandlerDealCreation } from "./dealCreation";
import { HandlerDealDeletion } from "./dealDeletion";
import { dealToDbDictionary } from "../../common/dictionaries/deal-dictionary";
import axios from "axios";
import { activePipelines } from "../../common/constant/activeDealPipelines";


@Injectable()

export class HandlerDealPropertyChange {

    constructor(
        private readonly prisma: PrismaService,
        private readonly dealCreation: HandlerDealCreation,
        private readonly dealDeletion: HandlerDealDeletion
    ){}

    async execute(event){
        let deal = await this.prisma.staff.findUnique({
            where: {
                hubspot_id: String(event.objectId)
            }
        })

        if(!deal ){
            await this.dealCreation.execute(event);
            deal = await this.prisma.staff.findUnique({
                where: {
                    hubspot_id: String(event.objectId)
                }
            })
        }
        if(!deal) return;

        if (
            deal && event.propertyName === 'pipeline' && 
            event.propertyValue !== '5155250' && 
            event.propertyValue !== '85165570'
        ) { //5155250 => BV Operations || 85165570 => MV Operations
            return await this.dealDeletion.execute(event);
        }


        //=====>
        const getObject = await axios.get(`https://api.hubapi.com/crm/v3/objects/deals/${event.objectId}/associations/${process.env.HUBSPOT_CUSTOM_OBJECT}`,
        {
        headers: {
            Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            },
        });

        if (getObject?.data?.results?.length > 0) {
            const candidateExists = await this.prisma.candidate.findUnique({
                where: {
                    hubspot_id: String(getObject.data.results[0].id)
                },
                select: {
                    id: true,
                }
            })

            await this.prisma.staff.update({
                where: {
                    id: deal.id
                },
                data: {
                    candidate_id: candidateExists ? candidateExists.id : null,
                    hubspot_candidate_id: getObject.data.results[0].id
                }
            })
        }
        //=====>

        //=====>
        const getObjectOrg = await axios.get(`https://api.hubapi.com/crm/v3/objects/deals/${event.objectId}/associations/companies`,
            {
            headers: {
                Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                },
            });
    
            if (getObjectOrg?.data?.results?.length > 0) {
                const OrganizationExists = await this.prisma.organization.findUnique({
                    where: {
                        hubspot_id: String(getObjectOrg.data.results[0].id)
                    },
                    select: {
                        id: true,
                        status: true
                    }
                })
                if (OrganizationExists && OrganizationExists.status === 'inactive') {

                    //check if the event.propertyName == 'dealstage' && event.propertyValue is in activePipelines
                    if (event.propertyName === 'dealstage' && activePipelines.some(([key]) => key === event.propertyValue)) {

                        //only update organization status to active if the dealstage is in activePipelines
                        await this.prisma.organization.update({
                            where: { id: OrganizationExists.id },
                            data: { status: 'active' }
                        });
                    }
                }
    
                await this.prisma.staff.update({
                    where: {
                        id: deal.id
                    },
                    data: {
                        organization_id: OrganizationExists ? OrganizationExists.id : null,
                        hubspot_organization_id: getObjectOrg.data.results[0].id
                    }
                })
            }
            //=====>


        const fieldExists = Object.keys(dealToDbDictionary).includes(event.propertyName);
        if(!fieldExists) return;

        let objectToUpdate: any = {};

        const fieldUpdated = dealToDbDictionary[event.propertyName];
        let value = event.propertyValue;

        objectToUpdate = {
            [fieldUpdated]: value
        }


        if (deal && event.propertyName == 'dealstage' && event.propertyValue == '148234581' ||
            deal && event.propertyName == 'dealstage' && event.propertyValue == '1012779094' ||
            deal && event.propertyName == 'dealstage' && event.propertyValue == '16981844' ||
            deal && event.propertyName == 'dealstage' && event.propertyValue == '31963952' ||

            deal && event.propertyName == 'dealstage' && event.propertyValue == '159176450' ||
            deal && event.propertyName == 'dealstage' && event.propertyValue == '1012777775' ||
            deal && event.propertyName == 'dealstage' && event.propertyValue == '159176451' ||
            deal && event.propertyName == 'dealstage' && event.propertyValue == '159176452'
        ) {
            objectToUpdate.status='terminated';
        }else{
            if(deal.status === 'terminated'){
                objectToUpdate.status='active';
            }
        }

        if (fieldUpdated === 'hubspot_close_date' || 
            fieldUpdated === 'start_date') {
            const timestamp = Number(event.propertyValue);
            if (!isNaN(timestamp)) {
              objectToUpdate[fieldUpdated] = new Date(timestamp).toISOString();
            }
        }
        
        
        await this.prisma.staff.update({
            where: {
                id: deal.id
            },
            data: {
                ...objectToUpdate
            }
        })
        
        return true;

    }
}