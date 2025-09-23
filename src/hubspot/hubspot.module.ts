import { forwardRef, Module } from '@nestjs/common';
import { HubspotController } from './hubspot.controller';
import { HubspotService } from './hubspot.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GoogledriveModule } from '../googledrive/googledrive.module';

import { CandidatesModule } from '../candidate/candidates.module';


import { HandlerObjectCreation } from './handlers/objectCreation';
import { HandlerObjectPropertyChange } from './handlers/objectPropertyChange';
import { HandlerObjectDeletion } from './handlers/objectDeletion';

import { HandlerOrganizationCreation } from './handlers/organizationCreation';


@Module({
  controllers: [HubspotController],
  providers: [HubspotService, HandlerObjectCreation, HandlerObjectPropertyChange, HandlerObjectDeletion, HandlerOrganizationCreation],
  imports: [PrismaModule, GoogledriveModule, forwardRef(() => CandidatesModule)],
  exports: [HubspotService],
})
export class HubspotModule {}
