import { Module } from '@nestjs/common';
import { HubspotController } from './hubspot.controller';
import { HubspotService } from './hubspot.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GoogledriveModule } from '../googledrive/googledrive.module';
import { HandlerObjectCreation } from './handlers/objectCreation';
import { HandlerObjectPropertyChange } from './handlers/objectPropertyChange';

@Module({
  controllers: [HubspotController],
  providers: [HubspotService, HandlerObjectCreation, HandlerObjectPropertyChange],
  imports: [PrismaModule, GoogledriveModule],
})
export class HubspotModule {}
