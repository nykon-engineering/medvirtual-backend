import { Injectable } from "@nestjs/common";
import axios from "axios";
import { PrismaService } from "../../prisma/prisma.service";
import { HandlerInvoiceCreation } from "./invoiceCreation";
import { invoiceToDbDictionary } from "../../common/dictionaries/invoice-dictionary";
import { HandlerComissionCreation } from "./comissionCreation";

@Injectable()

export class HandlerInvoicePropertyChange {

    constructor(
        private readonly prisma: PrismaService,
        private readonly invoiceCreation: HandlerInvoiceCreation,
        private readonly comissionCreation: HandlerComissionCreation,
    ){}

    async execute(event){
        let invoice = await this.prisma.hubspotInvoiceSnapshot.findUnique({
            where: {
                hubspot_id: String(event.objectId)
            }
        })

        if(!invoice ){
            await this.invoiceCreation.execute(event);
            invoice = await this.prisma.hubspotInvoiceSnapshot.findUnique({
                where: {
                    hubspot_id: String(event.objectId)
                }
            })
        }
        if(!invoice) return;
        

        const fieldExists = Object.keys(invoiceToDbDictionary).includes(event.propertyName);
        if(!fieldExists) return;

        let objectToUpdate: any = {};

        const fieldUpdated = invoiceToDbDictionary[event.propertyName];
        let value = event.propertyValue;

        objectToUpdate = {
            [fieldUpdated]: value
        }
        
        await this.prisma.hubspotInvoiceSnapshot.update({
            where: {
                hubspot_id: String(event.objectId)
            },
            data: {
                ...objectToUpdate
            }
        })

        //if we receive a invoice status change to 'paid', then create a comission for the affiliate linked
        // option from hubspot(hs_invoice_status): draft | open | paid | vaided
        if(event.propertyName === 'hs_invoice_status' && event.propertyValue === 'paid'){
            await this.comissionCreation.execute(event);

            console.log(`Invoice with Hubspot ID ${event.objectId} has been paid. We can create a comission for the affiliate linked to this invoice, if there is one.`);

            axios.get(`https://api.hubapi.com/crm/v3/objects/invoices/${event.objectId}?properties=hs_pdf_download_link`, {
                headers: {
                    Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            }).then(res => {
                const pdfLink = res.data?.properties?.hs_pdf_download_link;
                if (!pdfLink) return;
                return this.prisma.hubspotInvoiceSnapshot.update({
                    where: { hubspot_id: String(event.objectId) },
                    data: { hubspot_pdf_link: pdfLink },
                });
            }).catch(err => {
                console.error(`❌ Error fetching PDF link for invoice ${event.objectId}:`, err.message);
            });
        }


        return true;

    }
}