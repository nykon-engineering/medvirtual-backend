import { Module } from '@nestjs/common';
import { ContactService } from './contacts.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ContactService],
  exports: [ContactService],
})
export class ContactModule {}
