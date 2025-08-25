// src/sheets/sheets.service.ts
import { Injectable } from '@nestjs/common';

// Use seu ORM (Prisma/TypeORM). Vou ilustrar com uma store em memória + TODOs.
const seen = new Set<string>(); // substitua por Redis/DB para produção

@Injectable()
export class GooglesheetService {
  async isDuplicate(eventId: string) {
    return seen.has(eventId);
  }

  async processEvent(eventId: string, body: any) {
    seen.add(eventId);

    // TODO: salvar no banco (ex.: Prisma)
    // await this.prisma.sheetsEvent.create({ data: { eventId, payload: body } });

    // TODO: aplicar lógica de negócio:
    // - Se eventType === 'EDIT': atualizar registro
    // - Se eventType === 'INSERT_ROW': criar registro etc.
  }
}
