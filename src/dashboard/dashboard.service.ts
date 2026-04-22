import { BadRequestException, Injectable } from '@nestjs/common';
import { USER } from '@prisma/client';
import { HandlerOrganization } from './handlers/organization';
import { HandlerClient } from './handlers/client';
import { HandlerAffiliate } from './handlers/affiliate';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {

    constructor(
        private readonly organization: HandlerOrganization,
        private readonly client: HandlerClient,
        private readonly affiliate: HandlerAffiliate,
        private readonly prisma: PrismaService
    ) {}
              

    async getDashboardData(user: USER, page: number = 1, perPage: number = 10): Promise<any> {

        switch (user.role) {
            case 'organization_super_admin':
            case 'organization_admin':
                return await this.organization.execute(user, page, perPage);
            case 'system_super_admin':
            case 'system_admin':
                return await this.client.execute(user, page, perPage);
            case 'affiliate':
                return await this.affiliate.execute(user);
            default:
                throw new BadRequestException('Invalid currentUser role');
        }

        
    }

    async closeAlert(interviewId: string): Promise<any> {
        
        if (!interviewId) throw new BadRequestException('Interview ID is required');

        const closedInterview = await this.prisma.interview.update({
            where: { id: interviewId },
            data: { alert_closed: true }
        });
        if (!closedInterview) {
            throw new BadRequestException('Failed to close alert for the interview');
        }
        return closedInterview;
    }
}
