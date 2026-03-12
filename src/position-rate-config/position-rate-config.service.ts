import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePositionRateConfigDto } from './dto/update-position-rate-config.dto';

@Injectable()
export class PositionRateConfigService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.positionRateConfig.findMany({
      orderBy: { position: 'asc' },
    });
  }

  findByPosition(position: string) {
    return this.prisma.positionRateConfig.findUnique({
      where: { position },
    });
  }

  upsert(position: string, dto: UpdatePositionRateConfigDto) {
    const data = {
      medVirtual_floor_price_english: dto.medVirtual_floor_price_english,
      berryVirtual_floor_price_english: dto.berryVirtual_floor_price_english,
      medVirtual_floor_price_bilingual: dto.medVirtual_floor_price_bilingual,
      berryVirtual_floor_price_bilingual: dto.berryVirtual_floor_price_bilingual,
      medVirtual_margin_per_hour: dto.medVirtual_margin_per_hour,
      berryVirtual_margin_per_hour: dto.berryVirtual_margin_per_hour,
    };

    return this.prisma.positionRateConfig.upsert({
      where: { position },
      update: data,
      create: { position, ...data },
    });
  }
}
