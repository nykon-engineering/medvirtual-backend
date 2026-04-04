import { Injectable } from "@nestjs/common";
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
        }


        return true;

    }
}