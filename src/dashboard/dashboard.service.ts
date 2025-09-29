import { BadRequestException, Injectable } from '@nestjs/common';
import { USER } from '@prisma/client';
import { HandlerOrganization } from './handlers/organization';
import { HandlerClient } from './handlers/client';

@Injectable()
export class DashboardService {

    constructor(
        private readonly organization: HandlerOrganization,
        private readonly client: HandlerClient
    ) {}
              

    async getDashboardData(user: USER, page: number = 1, perPage: number = 10): Promise<any> {

        switch (user.role) {
            case 'organization_super_admin':
            case 'organization_admin':
                return await this.organization.execute(user, page, perPage);
            case 'system_super_admin':
            case 'system_admin':
                return await this.client.execute(user, page, perPage);
            default:
                throw new BadRequestException('Invalid currentUser role');
        }

        
    }
}
