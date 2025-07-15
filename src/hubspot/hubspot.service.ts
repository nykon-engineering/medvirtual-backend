import { Injectable } from '@nestjs/common';
import { Client } from '@hubspot/api-client'

@Injectable()
export class HubspotService {

    private hubspotClient: Client;

    constructor() {
        this.hubspotClient = new Client({ apiKey: process.env.HUBSPOT_ACCESS_TOKEN });
    }

    async getContacts() {
        try {
            const response = await this.hubspotClient.crm.contacts.getAll();
            return response;
        } catch (error) {
            console.error('Error fetching contacts from HubSpot:', error);
            throw error;
        }
    }
}
