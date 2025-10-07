import { BadRequestException, Injectable } from "@nestjs/common";
import axios from "axios";
import { ownerToDbDictionary } from "../../common/dictionaries/owner-dictionary";
import { mapDealToDb, mapOwnerToDb } from "../../common/utils/hubspot.util";
import { PrismaService } from "../../prisma/prisma.service";
import { dealToDbDictionary } from "../../common/dictionaries/deal-dictionary";


@Injectable()

export class HandlerDealCreation {
    constructor(
        private readonly prisma: PrismaService
    ){}


    async execute(event){
        
        //try{
            const properties = Object.keys(dealToDbDictionary).join(',');
            const getObject = await axios.get(`https://api.hubapi.com/crm/v3/objects/deals/${event.objectId}?properties=${properties}`,
            {
            headers: {
                Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                },
            });

            if (!getObject) {
                throw new BadRequestException('No object data found');
            }
            
            if (getObject.data.properties.pipeline && getObject.data.properties.pipeline !== '5155250') return; //Only process deals from BV OPERATIONS PIPELINE (5155250)

            
            const dealData = mapDealToDb(getObject.data.properties);
            dealData.status = 'active';
            //console.log('dealData before date conversion: ', dealData);
            dealData.hubspot_contract_sign_date = dealData.hubspot_contract_sign_date ? new Date(dealData.hubspot_contract_sign_date) : null;
            dealData.hubspot_close_date = dealData.hubspot_close_date ? new Date(dealData.hubspot_close_date) : null;
            

            const dealExists = await this.prisma.staff.findUnique({
                where: {
                    hubspot_id: String(event.objectId)
                }
            })
            if(dealExists) throw new BadRequestException('Deal already exists on the database');

            //Here I need to check if we alreadey have an candidate (VirtualAssistant) before we proceed with the deal Creation
            const getObjectVA = await axios.get(`https://api.hubapi.com/crm/v3/objects/deals/${event.objectId}/associations/${process.env.HUBSPOT_CUSTOM_OBJECT}`,
            {
            headers: {
                Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                },
            });
            //console.log('getObjectVA: ', getObjectVA.data);

            if (getObjectVA?.data?.results?.length > 0) {
                dealData.hubspot_candidate_id = getObjectVA.data.results[0].id

                const candidateExists = await this.prisma.candidate.findUnique({
                    where: {
                        hubspot_id: String(dealData.hubspot_candidate_id)
                    },
                    select: {
                        id: true,
                    }
                })
                if (candidateExists) dealData.candidate_id = candidateExists.id
            }
                
            const getObjectCompany = await axios.get(`https://api.hubapi.com/crm/v3/objects/deals/${event.objectId}/associations/companies`,
            {
            headers: {
                Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                },
            });
            //console.log('getObjectCompany: ', getObjectCompany.data);
            if (getObjectCompany?.data?.results?.length > 0) {
                dealData.hubspot_organization_id = getObjectCompany.data.results[0].id
                const organizationExists = await this.prisma.organization.findUnique({
                    where: {
                        hubspot_id: String(dealData.hubspot_organization_id)
                    },
                    select: {
                        id: true,
                    }
                })
                if (organizationExists) dealData.organization_id = organizationExists.id
            }
            //console.log('dealData after date conversion and associations: ', dealData);

            const dealCreated = await this.prisma.staff.create({
                data: dealData
            })
            if (!dealCreated) {
                throw new BadRequestException('Error creating Deal in the database');
            }

            return true;

        /*}catch (error) {
            throw new BadRequestException(`Error fetching object creation Deal: ${error.message}`);
        }*/
    }
}