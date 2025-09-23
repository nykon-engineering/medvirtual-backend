import { BadRequestException, Injectable } from "@nestjs/common";
import axios from "axios";

import { organizationToDbDictionary } from "../../common/dictionaries/organization-dictionary";
import { mapOrganizationToDb } from "src/common/utils/hubspot.util";
import { OrganizationRole, OrganizationStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";


@Injectable()

export class HandlerOrganizationCreation {
    constructor(
        private readonly prisma: PrismaService
    ) {}

    async execute(event){
        console.log("Handling organization creation event:", event);

        const properties = Object.keys(organizationToDbDictionary).join(',');
        try{
            const getObject = await axios.post('https://api.hubapi.com/crm/v3/objects/companies/search',
            {
            filterGroups: [
                {
                filters: [
                    {
                    propertyName: 'business_unit',
                    operator: 'EQ',
                    value: 'MedVirtual',
                    },
                    {
                    propertyName: 'hs_object_id',
                    operator: 'EQ',
                    value: event.objectId,
                    },
                ],
                },
            ],
            properties,
            limit: 100,
            },
            {
            headers: {
                Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
            }
            );

            if (!getObject) {
                throw new BadRequestException('No object data found');
            }

            const organizationData = mapOrganizationToDb(getObject.data.properties);
            organizationData.organization_role=OrganizationRole.client;
            organizationData.status=OrganizationStatus.active;


            const organizationExists = await this.prisma.organization.findUnique({
                where: {
                    hubspot_id: String(event.objectId)
                }
            })
            if(organizationExists) throw new BadRequestException('Organization already exists on the database');

            const createOrganization = await this.prisma.organization.create({
                data: organizationData,
            })
            if (!createOrganization) {
                throw new BadRequestException('Error creating organization in the database');
            }
            
            console.log(`Organization created with ID: ${createOrganization.id}, Name: ${createOrganization.name}`);

            return true;

        }catch (error) {
            throw new BadRequestException(`Error fetching object creation organization: ${error.message}`);
        }
    }
}