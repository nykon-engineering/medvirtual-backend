import { BadRequestException, Injectable } from "@nestjs/common";
import axios from "axios";
import { ownerToDbDictionary } from "../../common/dictionaries/owner-dictionary";
import { mapOwnerToDb } from "../../common/utils/hubspot.util";
import { PrismaService } from "../../prisma/prisma.service";
import { dealToDbDictionary } from "../../common/dictionaries/deal-dictionary";


@Injectable()

export class HandlerDealCreation {
    constructor(
        private readonly prisma: PrismaService
    ){}


    async execute(event){
        
        try{
            const properties = Object.keys(dealToDbDictionary).join(',');
            const getObject = await axios.get(`https://api.hubapi.com/crm/v3/deals/${event.objectId}?properties=${properties}`,
            {
            headers: {
                Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                },
            });

            if (!getObject) {
                throw new BadRequestException('No object data found');
            }
            
            const dealData = mapOwnerToDb(getObject.data.results[0].properties);
            

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

            if (getObjectVA) {
                dealData.hubspot_candidate_id = getObject.data.results[0].id
            }
                
            const getObjectCompany = await axios.get(`https://api.hubapi.com/crm/v3/objects/deals/${event.objectId}/associations/companies`,
            {
            headers: {
                Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                },
            });

            if (getObjectCompany) {
                dealData.hubspot_organization_id = getObject.data.results[0].id
            }
                    

            const dealCreated = await this.prisma.staff.create(dealData)
            if (!dealCreated) {
                throw new BadRequestException('Error creating Deal in the database');
            }

            return true;

        }catch (error) {
            throw new BadRequestException(`Error fetching object creation Deal: ${error.message}`);
        }
    }
}