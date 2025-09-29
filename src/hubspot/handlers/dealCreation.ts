import { BadRequestException, Injectable } from "@nestjs/common";
import axios from "axios";
import { ownerToDbDictionary } from "../../common/dictionaries/owner-dictionary";
import { mapOwnerToDb } from "../../common/utils/hubspot.util";
import { PrismaService } from "../../prisma/prisma.service";
import { dealToDbDictionary } from "src/common/dictionaries/deal-dictionary";


@Injectable()

export class HandlerDealCreation {
    constructor(
        private readonly prisma: PrismaService
    ){}


    async execute(event){
        const properties = Object.keys(dealToDbDictionary).join(',');
        try{
            const getObject = await axios.get(`https://api.hubapi.com/crm/v3/deals/${event.objectId}`,
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

            //Here I need to check if we alreadey have an organization and candidate before we proceed with the deal Creation
            //endpoint to associoations:  or 
            //  -https://api.hubapi.com/crm/v3/objects/deals/${deal}/associations/companies
            //  -https://api.hubapi.com/crm/v3/objects/deals/${deal}/associations/p20630393_Virtual_Assistant

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