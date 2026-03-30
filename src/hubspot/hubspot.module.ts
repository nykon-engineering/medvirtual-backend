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
import { HandlerOrganizationMerge } from './handlers/organizationMerge';
import { HandlerOrganizationAssociationChange } from './handlers/organizationAssociationChange';

import { HandlerOwnerCreation } from './handlers/ownerCreation';
import { HandlerOwnerDeletion } from './handlers/ownerDeletion';
import { HandlerOwnerPropertyChange } from './handlers/ownerPropertyChange';
import { HandlerDealCreation } from './handlers/dealCreation';
import { HandlerDealPropertyChange } from './handlers/dealPropertyChange';
import { HandlerDealDeletion } from './handlers/dealDeletion';

import { HandlerDealAssociationChange } from './handlers/dealAssociationChange';
import { HireRequestCreationService } from './create/hireRequest';
import { HireRequestUpdateService } from './update/hireRequest';
import { HandlerTicketCreation } from './handlers/ticketCreation';
import { HandlerTicketRestore } from './handlers/ticketRestore';
import { HandlerTicketDeletion } from './handlers/ticketDeletion';
import { HandlerTicketPropertyChange } from './handlers/ticketPropertyChange';

import { HandlerAffiliateCreation } from './handlers/affiliateCreation';
import { HandlerAffiliatePropertyChange } from './handlers/affiliatePropertyChange';


import { HireRequestModule } from '../hire-request/hire-request.module';

import { OrganizationCreationService } from './create/Organization';
import { HandlerObjectMerge } from './handlers/objectMerge';
import { OwnerCreationService } from './create/Owner';
import { OrganizationUpdateService } from './update/organization';
import { ContactCreationService } from './create/contact';
import { ContactUpdateService } from './update/contact';
import { ContactDeleteService } from './delete/contact';
import { MailModule } from '../mail/mail.module';






@Module({
  controllers: [HubspotController],
  providers: [HubspotService, 
    HandlerObjectCreation, 
    HandlerObjectPropertyChange, 
    HandlerObjectDeletion, 
    HandlerObjectMerge,
    HandlerOrganizationCreation, 
    HandlerOrganizationPropertyChange,
    HandlerOrganizationDeletion,
    HandlerOrganizationMerge,
    HandlerOrganizationAssociationChange,
    HandlerOwnerCreation,
    HandlerOwnerDeletion,
    HandlerOwnerPropertyChange,
    HandlerDealCreation,
    HandlerDealPropertyChange,
    HandlerDealDeletion,
    HandlerDealAssociationChange,
    HandlerTicketCreation,
    HandlerTicketRestore,
    HandlerTicketDeletion,
    HandlerTicketPropertyChange,
    HandlerAffiliateCreation,
    HandlerAffiliatePropertyChange,
    HireRequestCreationService,
    HireRequestUpdateService,
    OrganizationCreationService,
    OwnerCreationService,
    OrganizationUpdateService,
    ContactCreationService,
    ContactUpdateService,
    ContactDeleteService
  ],
  imports: [PrismaModule, 
    GoogledriveModule, 
    MailModule,
    forwardRef(() => CandidatesModule), 
    forwardRef(() => OrganizationModule), 
    forwardRef(() => HireRequestModule) ],
  exports: [HubspotService, 
    HandlerOrganizationCreation, 
    HandlerObjectCreation, 
    HandlerDealCreation, 
    HireRequestCreationService,
    HireRequestUpdateService,
  
  ],
})
export class HubspotModule {}
