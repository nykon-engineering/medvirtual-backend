import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { hrTicketToDbDictionary } from "../../common/dictionaries/HRTicket-dicionary";
import { timestampToDate } from "../../common/utils/formatDate";
import axios from "axios";

const TITLE_AFFECTING_DB_FIELDS = new Set(['availability', 'hubspot_numberVA', 'hubspot_pairing_request_type']);

@Injectable()

export class HandlerTicketPropertyChange {

    constructor(
        private readonly prisma: PrismaService,
    ){}

    private buildTitle(hr: {
        hubspot_pairing_request_type?: string | null;
        hubspot_numberVA?: number | null;
        request_role?: string | null;
        availability?: string | null;
        organization: { name: string };
    }): string {
        const isProduction = process.env.ENVIRONMENT === 'PROD';
        const basePrefix = isProduction ? 'HR' : 'TEST HR';
        const requestType = hr.hubspot_pairing_request_type || '';
        const firstPrefix = requestType === 'Upsell Agent' ? 'UPS '
            : requestType === 'Agent Replacement' ? 'REP '
            : '';

        const parts: string[] = [(firstPrefix + basePrefix).trim()];

        if (hr.organization?.name?.trim()) {
            parts.push(hr.organization.name);
        }

        if (hr.hubspot_numberVA) {
            parts.push(String(hr.hubspot_numberVA));
        }

        if (hr.request_role?.trim()) {
            parts.push(hr.request_role);
        }

        if (hr.availability?.trim()) {
            const formatted = hr.availability
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join('-');
            if (formatted.trim()) {
                parts.push(formatted);
            }
        }

        return parts.filter(p => p?.trim()).join(' - ');
    }

    private async syncTitle(hrId: string, hubspotTicketId: string): Promise<void> {
        const hr = await this.prisma.hireRequest.findUnique({
            where: { id: hrId },
            select: {
                hubspot_pairing_request_type: true,
                hubspot_numberVA: true,
                request_role: true,
                availability: true,
                organization: { select: { name: true } },
            },
        });
        if (!hr) return;

        const title = this.buildTitle(hr);

        await this.prisma.hireRequest.update({
            where: { id: hrId },
            data: { title },
        });

        try {
            await axios.patch(
                `https://api.hubapi.com/crm/v3/objects/tickets/${hubspotTicketId}`,
                { properties: { subject: title } },
                {
                    headers: {
                        Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                        'Content-Type': 'application/json',
                    },
                },
            );
        } catch (error) {
            console.error('Error syncing title to HubSpot:', error.response?.data ?? error.message);
        }
    }

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
            value = timestampToDate(event.propertyValue);
        }
        

        await this.prisma.hireRequest.update({
            where: {
                id: hr.id
            },
            data: {
                [fieldUpdated]: value
            }
        })

        if (TITLE_AFFECTING_DB_FIELDS.has(fieldUpdated)) {
            await this.syncTitle(hr.id, String(event.objectId));
        }

        return true;

    }
}