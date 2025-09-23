import { forwardRef, Module } from '@nestjs/common';
import { HubspotController } from './hubspot.controller';
import { HubspotService } from './hubspot.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GoogledriveModule } from '../googledrive/googledrive.module';
import { CandidatesModule } from '../candidate/candidates.module';
import { OrganizationModule } from '../organization/organization.module';

import { HandlerObjectCreation } from './handlers/objectCreation';
import { HandlerObjectPropertyChange } from './handlers/objectPropertyChange';
import { HandlerObjectDeletion } from './handlers/objectDeletion';

import { HandlerOrganizationCreation } from './handlers/organizationCreation';
import { HandlerOrganizationPropertyChange } from './handlers/organizationPropertyChange';
import { HandlerOrganizationDeletion } from './handlers/organizationDeletion';



@Module({
  controllers: [HubspotController],
  providers: [HubspotService, 
    HandlerObjectCreation, 
    HandlerObjectPropertyChange, 
    HandlerObjectDeletion, 
    HandlerOrganizationCreation, 
    HandlerOrganizationPropertyChange,
    HandlerOrganizationDeletion
  ],
  imports: [PrismaModule, GoogledriveModule, forwardRef(() => CandidatesModule), OrganizationModule],
  exports: [HubspotService],
})
export class HubspotModule {}
