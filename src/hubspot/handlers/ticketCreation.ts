import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
} from '@nestjs/common';
import axios from 'axios';

import { mapHRTicketToDb } from '../../common/utils/hubspot.util';
import { PrismaService } from '../../prisma/prisma.service';
import { HireRequestService } from '../../hire-request/hire-request.service';
import { hrTicketToDbDictionary } from '../../common/dictionaries/HRTicket-dicionary';

@Injectable()
export class HandlerTicketCreation {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hireRequestService: HireRequestService,
  ) {}

  async execute(event) {
    const properties = Object.keys(hrTicketToDbDictionary).join(',');
    try {
      const getObject = await axios.post(
        'https://api.hubapi.com/crm/v3/objects/tickets/search',
        {
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'hs_object_id',
                  operator: 'EQ',
                  value: `${event.objectId}`,
                },
                {
                  propertyName: 'hs_pipeline',
                  operator: 'EQ',
                  value: '0',
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
        },
      );

      if (!getObject) throw new BadRequestException('No object data found');

      const ticketData = mapHRTicketToDb(getObject.data.results[0].properties);

      //console.log('Mapped Ticket data:', ticketData);

      ticketData.status = 'new';
      ticketData.hubspot_pairing_date = ticketData.hubspot_pairing_date
        ? String(ticketData.hubspot_pairing_date)
        : null;

      const ticketExists = await this.prisma.hireRequest.findUnique({
        where: {
          hubspot_ticket_id: String(event.objectId),
        },
      });
      if (ticketExists)
        throw new BadRequestException(
          'Hire Request already exists on the database',
        );

      const createTicket = await this.hireRequestService.create(ticketData);
      if (!createTicket) {
        throw new BadRequestException(
          'Error creating Hire Request in the database',
        );
      }
      return true;
    } catch (error) {
      throw new BadRequestException(
        `Error fetching object on creation HR: ${error.message}`,
      );
    }
  }
}
