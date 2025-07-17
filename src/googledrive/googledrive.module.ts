import { Module } from '@nestjs/common';
import { GoogledriveController } from './googledrive.controller';
import { GoogledriveService } from './googledrive.service';

@Module({
  controllers: [GoogledriveController],
  providers: [GoogledriveService]
})
export class GoogledriveModule {}
