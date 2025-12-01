import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { hrTicketToDbDictionary } from "../../common/dictionaries/HRTicket-dicionary";

@Injectable()

export class HandlerTicketPropertyChange {

    constructor(
        private readonly prisma: PrismaService,
    ){}

    async execute(event){
        const hr = await this.prisma.hireRequest.findUnique({
            where: {
                hubspot_ticket_id: String(event.objectId)
            }
        })
        if(!hr) return;

        if (event.propertyName === 'va_pay_rate_range') {
            //We receive a text like '120 - 150' and we need to parse it for 2 fields: salary_range_from and salary_range_to
            const [from, to] = event.propertyValue.split('-').map(value => parseFloat(value.trim()));
            await this.prisma.hireRequest.update({
                where: {
                    id: hr.id
                },
                data: {
                    salary_range_from: from,
                    salary_range_to: to
                }
            })

            return true;
        }

        const fieldExists = Object.keys(hrTicketToDbDictionary).includes(event.propertyName);
        if(!fieldExists) return;

        const fieldUpdated = hrTicketToDbDictionary[event.propertyName];
        let value = event.propertyValue;

        if (fieldUpdated === 'hubspot_pipeline_stage') return false; // skip updating pipeline stage for Ticket / HR
        if (fieldUpdated === 'hubspot_numberVA') {
            value = parseInt(event.propertyValue);
        }
        // => Handle with pairing date and pairing time, because this field is within other table

        await this.prisma.hireRequest.update({
            where: {
                id: hr.id
            },
            data: {
                [fieldUpdated]: value
            }
        })
        
        return true;

    }
}