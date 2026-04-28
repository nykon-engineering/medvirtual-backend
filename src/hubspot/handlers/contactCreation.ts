import { BadRequestException, Injectable } from "@nestjs/common";
import axios from "axios";
import { mapContactToDb } from "../../common/utils/hubspot.util";
import { PrismaService } from "../../prisma/prisma.service";
import { contactToDbDictionary } from "../../common/dictionaries/contact-dictionary";


@Injectable()

export class HandlerContactCreation {
    constructor(
        private readonly prisma: PrismaService
    ){}


    async execute(event){
        const properties = Object.keys(contactToDbDictionary).join(',');
        try{
            const getObject = await axios.get(`https://api.hubapi.com/crm/v3/objects/contacts/${event.id}?properties=${properties}`,
            {
            headers: {
                Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                },
            });

            if (!getObject) {
                throw new BadRequestException('No object data found');
            }
            console.log('Fetched Contact Data from HubSpot:', getObject.data);
            const contactData = mapContactToDb(getObject.data.results[0].properties);
            

            const contactExists = await this.prisma.contact.findUnique({
                where: {
                    hubspot_id: String(event.id)
                }
            })
            if(contactExists) throw new BadRequestException('Contact already exists on the database');

            const createdContact = await this.prisma.contact.create({ data: contactData });
            if (!createdContact) {
                throw new BadRequestException('Error creating Contact in the database');
            }

            return true;

        }catch (error) {
            throw new BadRequestException(`Error fetching object creation Contact: ${error.message}`);
        }
    }
}