import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OwnerCreationService {
  constructor(private readonly prisma: PrismaService) {}

  async execute(data: any): Promise<any> {
    try {
      const response = await axios.post(
        'https://api.hubapi.com/crm/v3/owners',
        {
          properties: {
            firstname: data.first_name,
            lastname: data.last_name,
            email: data.email,
            type: 'PERSON',
          },
          associations: [],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      );

      //onsole.log(' Response: ',response.data);
      //update hireRequest with the hubspot_ticket_id
      await this.prisma.uSER.update({
        where: { id: data.id },
        data: { hubspot_id: response.data.id },
      });

      return true;
    } catch (error) {
      if (error.response) {
        console.error('Error to created OWNER:', error.response.data);
      } else {
        console.error('Connection error:', error.message);
      }
    }
  }
}
