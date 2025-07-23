import { Module } from '@nestjs/common';
import { HubspotController } from './hubspot.controller';
import { HubspotService } from './hubspot.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GoogledriveModule } from '../googledrive/googledrive.module';

@Module({
  controllers: [HubspotController],
  providers: [HubspotService],
  imports: [PrismaModule, GoogledriveModule],
})
export class HubspotModule {}
