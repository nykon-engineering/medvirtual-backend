import { BadRequestException, Injectable } from "@nestjs/common";
import axios from "axios";
import { mapInvoiceToDb } from "../../common/utils/hubspot.util";
import { PrismaService } from "../../prisma/prisma.service";
import { invoiceToDbDictionary } from "../../common/dictionaries/invoice-dictionary";
import { get } from "http";


const sleep = (ms: number) =>
        new Promise(resolve => setTimeout(resolve, ms));

async function retry(fn, retries = 3, delay = 500) {
    try {
        return await fn();
    } catch (err) {
        if (
        retries > 0 &&
        axios.isAxiosError(err) &&
        err.response?.status === 429
        ) {
        await sleep(delay);
        return retry(fn, retries - 1, delay * 2); // exponential backoff
        }
        throw err;
    }
}


@Injectable()

export class HandlerInvoiceCreation {
    constructor(
        private readonly prisma: PrismaService
    ){}

    async execute(event){
        try{
            const invoiceExists = await this.prisma.hubspotInvoiceSnapshot.findUnique({
                where: {
                    hubspot_id: String(event.objectId)
                }
            })
            if(invoiceExists){
                console.log(`Invoice with Hubspot ID ${event.objectId} already exists. Skipping creation.`);
                return ;
            }

            const properties = Object.keys(invoiceToDbDictionary).join(',');
            const getObject = await retry(() => 
                axios.get(`https://api.hubapi.com/crm/v3/objects/invoices/${event.objectId}?properties=${properties}&associations=line_items,companies`,
                {
                headers: {
                    Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json',
                    },
                })
            );

            if (!getObject) {
                throw new BadRequestException('No object data found');
            }
            
            //console.log("Associations companies:", getObject.data.associations?.companies);
            //console.log(`Associations line_items:`, getObject.data.associations?.['line items']);

            const invoiceData = mapInvoiceToDb(getObject.data.properties);
            
           
            const companyAssociated = getObject.data.associations?.companies;
            if (companyAssociated?.results?.length > 0) {
                invoiceData.organization_id = companyAssociated.results[0].id
                const organizationExists = await this.prisma.organization.findUnique({
                    where: {
                        hubspot_id: String(invoiceData.organization_id)
                    },
                    select: {
                        id: true,
                        status: true
                    }
                })
                if (organizationExists) invoiceData.organization_id = organizationExists.id;
                if (organizationExists && organizationExists.status === 'inactive') {
                    await this.prisma.organization.update({
                        where: { id: organizationExists.id },
                        data: { status: 'active' }
                    });
                }
            }

            const invoiceCreated = await this.prisma.hubspotInvoiceSnapshot.create({
                data: invoiceData
            })
            if (!invoiceCreated) {
                throw new BadRequestException('Error creating Invoice in the database');
            }

            //Start to get line items details and create them in the database
            const lineItemsAssociated = getObject.data.associations?.['line items'];
            if (lineItemsAssociated?.results?.length > 0) {
                for (const lineItem of lineItemsAssociated.results) {
                    try {
                        const lineItemDetails = await retry(() => 
                            axios.get(`https://api.hubapi.com/crm/v3/objects/line_items/${lineItem.id}?properties=amount,description,discount,quantity,name`,
                            {
                            headers: {
                                Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                                'Content-Type': 'application/json',
                                },
                            })
                        );
                        const lineItemData = {
                            hubspot_id: lineItem.id,
                            quantity: lineItemDetails.data.properties.quantity,
                            amount: lineItemDetails.data.properties.amount,
                            description: lineItemDetails.data.properties.description,
                            name: lineItemDetails.data.properties.name,
                            invoice_id: invoiceCreated.id
                        }
                        console.log(`Line item data for line item ${lineItem.id}:`, lineItemData);
                        await this.prisma.hubspotLineItemSnapshot.create({
                            data: lineItemData
                        })
                    } catch (error) {
                        console.error(`❌ Error fetching line item ${lineItem.id} details from HubSpot`);
                        console.error('Status:', error.response?.status);
                        console.error('Data:', error.response?.data);
                        console.error('Message:', error.message);
                    }
                }
            }

            return true;

        }catch (error) {
            console.error(`❌ Error fetching invoice ${event.objectId} from HubSpot`);
            console.error('Status:', error.response?.status);
            console.error('Data:', error.response?.data);
            console.error('Message:', error.message);
            throw new BadRequestException(`Error fetching object creation Invoice: ${error.message}`);
        }
    }
}