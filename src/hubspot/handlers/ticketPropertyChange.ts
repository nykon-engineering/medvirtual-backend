import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { hrTicketToDbDictionary } from "../../common/dictionaries/HRTicket-dicionary";
import { timestampToUSDate } from "../../common/utils/formatDate";

@Injectable()

export class HandlerTicketPropertyChange {

    constructor(
        private readonly prisma: PrismaService,
    ){}

    private async getUserId(hubspotId: string): Promise<string | null> {
      if (!hubspotId) return null;
      const user = await this.prisma.uSER.findUnique({
        where: { hubspot_id: hubspotId },
        select: {
          id: true,
        },
          
      });

      /* => Commented because we cannot create owners using hubspot API
      if (user && !user.hubspot_id) {
        await this.ownerCreationService.execute(user)
      }
      */

      return user && user.id ? user.id : null; 
    }

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

        let value = event.propertyValue;
        
        if (event.propertyName === 'pairing_specialist') {
            //assign_sourcing_id
            value = await this.getUserId(event.propertyValue);

            if(!value) return true;
            await this.prisma.hireRequest.update({
                where: {
                    id: hr.id
                },
                data: {
                    assign_sourcing_id: value
                }
            })
            
            return true;
        }

        if (event.propertyName === 'hubspot_owner_id') {
            //assign_user_id
            value = await this.getUserId(event.propertyValue);

            if(!value) return true;
            await this.prisma.hireRequest.update({
                where: {
                    id: hr.id
                },
                data: {
                    assign_user_id: value
                }
            })
            
            return true;
        }

        if (event.propertyName === 'staffing_coordinator') {
            //assign_staffing_coordinator
            value = await this.getUserId(event.propertyValue);

            if(!value) return true;
            await this.prisma.hireRequest.update({
                where: {
                    id: hr.id
                },
                data: {
                    assign_staffing_coordinator: value
                }
            })
            
            return true;
        }

        const fieldExists = Object.keys(hrTicketToDbDictionary).includes(event.propertyName);
        if(!fieldExists) return;

        const fieldUpdated = hrTicketToDbDictionary[event.propertyName];
        

        if (fieldUpdated === 'hubspot_pipeline_stage') return false; // skip updating pipeline stage for Ticket / HR
        if (fieldUpdated === 'hubspot_numberVA') {
            value = parseInt(event.propertyValue);
        }
        
        if (fieldUpdated === 'expected_start_date') {
            value = timestampToUSDate(event.propertyValue);
        }
        

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