import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { HandlerDealCreation } from "./dealCreation";
import { HandlerDealDeletion } from "./dealDeletion";
import { dealToDbDictionary } from "../../common/dictionaries/deal-dictionary";
import axios from "axios";


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

        if (deal && event.propertyName === 'pipeline' && event.propertyValue !== '5155250') { //5155250 => BV Operations
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
            //console.log('getObject: ', getObject.data);

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
            deal && event.propertyName == 'dealstage' && event.propertyValue == '16981844'
        ) {
            objectToUpdate.status='terminated';
        }else{
            if(deal.status === 'terminated'){
                objectToUpdate.status='active';
            }
        }
        


        if (fieldUpdated === 'hubspot_close_date') {
            const timestamp = Number(event.propertyValue);
            if (!isNaN(timestamp)) {
              value = new Date(timestamp).toISOString();
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