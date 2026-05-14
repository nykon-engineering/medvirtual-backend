import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HandlerContactCreation } from './contactCreation';
import { contactToDbDictionary } from '../../common/dictionaries/contact-dictionary';

@Injectable()
export class HandlerContactPropertyChange {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contactCreation: HandlerContactCreation,
  ) {}

  async execute(event) {
    const contact = await this.prisma.contact.findUnique({
      where: {
        hubspot_id: String(event.objectId),
      },
    });

    if (!contact) return await this.contactCreation.execute(event);

    const fieldExists = Object.keys(contactToDbDictionary).includes(
      event.propertyName,
    );
    if (!fieldExists) return;

    const fieldUpdated = contactToDbDictionary[event.propertyName];

    await this.prisma.contact.update({
      where: {
        id: contact.id,
      },
      data: {
        [fieldUpdated]: event.propertyValue,
      },
    });

    return true;
  }
}
