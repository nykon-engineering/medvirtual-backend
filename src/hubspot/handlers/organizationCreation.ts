import { BadRequestException, Injectable } from "@nestjs/common";
import axios from "axios";

import { organizationToDbDictionary } from "../../common/dictionaries/organization-dictionary";
import { mapOrganizationToDb } from "../../common/utils/hubspot.util";
import { OrganizationRole, OrganizationStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { OrganizationService } from "../../organization/organization.service";


@Injectable()

export class HandlerOrganizationCreation {
    constructor(
        private readonly prisma: PrismaService,
        private readonly organizationService: OrganizationService
    ) {}

    async execute(event){

        const properties = Object.keys(organizationToDbDictionary).join(',')+ ',business_unit';
        try{
            const getObject = await axios.post('https://api.hubapi.com/crm/v3/objects/companies/search',
            {
            filterGroups: [
                {
                filters: [
                    {
                    propertyName: 'hs_object_id',
                    operator: 'EQ',
                    value: `${event.objectId}`,
                    },
                ],
                },
            ],
            properties: properties.split(','),
            limit: 100,
            },
            {
            headers: {
                Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                },
            }
            );
            
            if (!getObject) throw new BadRequestException('No object data found');
            if(getObject.data.results[0].properties.business_unit !== 'MedVirtual') throw new BadRequestException('Organization is not a client of MedVirtual');

            const organizationData = mapOrganizationToDb(getObject.data.results[0].properties);

            organizationData.status=OrganizationStatus.active;
            organizationData.email = organizationData.email ?? undefined;

            const organizationExists = await this.prisma.organization.findUnique({
                where: {
                    hubspot_id: String(event.objectId)
                }
            })
            if(organizationExists) throw new BadRequestException('Organization already exists on the database');

            const createOrganization = await this.organizationService.create(organizationData)
            if (!createOrganization) {
                throw new BadRequestException('Error creating organization in the database');
            }
            return true;

        
        }catch (error) {
            throw new BadRequestException(`Error fetching object creation organization: ${error.message}`);
        }
            
    }
}