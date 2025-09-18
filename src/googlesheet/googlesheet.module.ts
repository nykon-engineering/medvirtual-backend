import { Module } from '@nestjs/common';
import { GooglesheetController } from './googlesheet.controller';
import { GooglesheetService } from './googlesheet.service';

@Module({
  controllers: [GooglesheetController],
  providers: [GooglesheetService]
})
export class GooglesheetModule {}
