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

            const invoiceWithOrg = await this.prisma.hubspotInvoiceSnapshot.findUnique({
                where: { hubspot_id: String(event.objectId) },
                select: {
                    organization: {
                        select: {
                            id: true,
                            referred_by_affiliate_id: true,
                            med_alliance_referral_status: true,
                            med_alliance_block_reason: true,
                            first_paid_invoice_at: true,
                        }
                    }
                }
            });

            const org = invoiceWithOrg?.organization;
            const shouldActivate =
                org &&
                org.referred_by_affiliate_id !== null &&
                org.med_alliance_referral_status === 'not_eligible' &&
                !org.med_alliance_block_reason?.startsWith('active_client_block') &&
                org.first_paid_invoice_at === null;

            if (shouldActivate) {
                const now = new Date();
                await this.prisma.organization.update({
                    where: { id: org.id },
                    data: {
                        med_alliance_referral_status: 'eligible',
                        eligibility_start_at: now,
                        first_paid_invoice_at: now,
                        med_alliance_block_reason: null,
                    },
                });
                console.log(`Organization ${org.id} activated as eligible after first paid invoice ${event.objectId}.`);
            }

            axios.get(`https://api.hubapi.com/crm/v3/objects/invoices/${event.objectId}?properties=hs_pdf_download_link`, {
                headers: {
                    Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            }).then(res => {
                const pdfLink = res.data?.properties?.hs_pdf_download_link;
                console.log(`Fetched PDF link for invoice ${event.objectId}:`, pdfLink);
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