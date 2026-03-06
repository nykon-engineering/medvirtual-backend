import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MLService } from './ml.service';

@Module({
  imports: [ConfigModule],
  providers: [MLService],
  exports: [MLService],
})
export class MLModule {}
