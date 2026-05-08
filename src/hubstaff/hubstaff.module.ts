import { Module } from '@nestjs/common';
import { HubstaffService } from './hubstaff.service';
import { SecretsModule } from '../secrets/secrets.module';

@Module({
  imports: [SecretsModule],
  providers: [HubstaffService],
  exports: [HubstaffService],
})
export class HubstaffModule {}
