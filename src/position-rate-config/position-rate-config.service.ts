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
      floor_price_english:
        dto.floor_price_english !== undefined ? dto.floor_price_english : undefined,
      hourly_rate_english:
        dto.hourly_rate_english !== undefined ? dto.hourly_rate_english : undefined,
      floor_price_bilingual:
        dto.floor_price_bilingual !== undefined ? dto.floor_price_bilingual : undefined,
      hourly_rate_bilingual:
        dto.hourly_rate_bilingual !== undefined ? dto.hourly_rate_bilingual : undefined,
      margin_per_hour:
        dto.margin_per_hour !== undefined ? dto.margin_per_hour : undefined,
    };

    return this.prisma.positionRateConfig.upsert({
      where: { position },
      update: data,
      create: { position, ...data },
    });
  }
}
