import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessUnitDto } from './dto/create-business-unit.dto';
import { UpdateBusinessUnitDto } from './dto/update-business-unit.dto';
import { UpdateBrandingDto } from './dto/update-branding.dto';

@Injectable()
export class BusinessUnitsService {
  private readonly logger = new Logger(BusinessUnitsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── List ──────────────────────────────────────────────────────────────────

  async findAll() {
    const data = await this.prisma.businessUnit.findMany({
      orderBy: { name: 'asc' },
      include: { branding: true },
    });
    return { status: 200, data };
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async create(dto: CreateBusinessUnitDto, userId: string) {
    const existing = await this.prisma.businessUnit.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new BadRequestException(
        `A business unit with slug "${dto.slug}" already exists`,
      );
    }

    // Create BU and its default EmailBranding in a single transaction
    const [bu] = await this.prisma.$transaction([
      this.prisma.businessUnit.create({
        data: { slug: dto.slug, name: dto.name, created_by: userId },
      }),
      this.prisma.emailBranding.create({
        data: {
          business_unit: dto.slug,
          primary_color: '#01546B',
          secondary_color: '#013A4F',
          logo_url: 'https://staging.medvirtual.ai/logo.png',
          company_name: dto.name,
          layout_preset: 'default',
          updated_by: userId,
        },
      }),
    ]);

    return { status: 201, data: bu };
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(slug: string, dto: UpdateBusinessUnitDto) {
    await this.findOneOrThrow(slug);

    const updated = await this.prisma.businessUnit.update({
      where: { slug },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active }),
      },
      include: { branding: true },
    });

    return { status: 200, data: updated };
  }

  // ── Deactivate (soft delete) ──────────────────────────────────────────────

  async deactivate(slug: string) {
    await this.findOneOrThrow(slug);

    const updated = await this.prisma.businessUnit.update({
      where: { slug },
      data: { is_active: false },
    });

    return { status: 200, data: updated };
  }

  // ── Branding ──────────────────────────────────────────────────────────────

  async getBranding(slug: string) {
    await this.findOneOrThrow(slug);

    const branding = await this.prisma.emailBranding.findUnique({
      where: { business_unit: slug },
    });
    if (!branding)
      throw new NotFoundException(`Branding for "${slug}" not found`);

    return { status: 200, data: branding };
  }

  async updateBranding(slug: string, dto: UpdateBrandingDto, userId: string) {
    await this.findOneOrThrow(slug);

    const current = await this.prisma.emailBranding.findUnique({
      where: { business_unit: slug },
    });
    if (!current)
      throw new NotFoundException(`Branding for "${slug}" not found`);

    // Snapshot to history before overwriting
    await this.prisma.emailBrandingHistory.create({
      data: {
        branding_id: current.id,
        snapshot: {
          primary_color: current.primary_color,
          secondary_color: current.secondary_color,
          logo_url: current.logo_url,
          company_name: current.company_name,
          layout_preset: current.layout_preset,
        },
        changed_by: userId,
      },
    });

    const updated = await this.prisma.emailBranding.update({
      where: { business_unit: slug },
      data: {
        ...(dto.primary_color !== undefined && {
          primary_color: dto.primary_color,
        }),
        ...(dto.secondary_color !== undefined && {
          secondary_color: dto.secondary_color,
        }),
        ...(dto.logo_url !== undefined && { logo_url: dto.logo_url }),
        ...(dto.company_name !== undefined && {
          company_name: dto.company_name,
        }),
        ...(dto.layout_preset !== undefined && {
          layout_preset: dto.layout_preset,
        }),
        updated_by: userId,
      },
    });

    // Fire-and-forget sync to peer environment
    this.syncBrandingToPeer(slug, updated, userId).catch((err) =>
      this.logger.error(
        `Branding sync to peer failed for "${slug}": ${err.message}`,
      ),
    );

    return { status: 200, data: updated };
  }

  async getBrandingHistory(slug: string) {
    await this.findOneOrThrow(slug);

    const branding = await this.prisma.emailBranding.findUnique({
      where: { business_unit: slug },
      select: { id: true },
    });
    if (!branding)
      throw new NotFoundException(`Branding for "${slug}" not found`);

    const history = await this.prisma.emailBrandingHistory.findMany({
      where: { branding_id: branding.id },
      orderBy: { changed_at: 'desc' },
      take: 50,
    });

    return { status: 200, data: history };
  }

  // ── Sync ──────────────────────────────────────────────────────────────────

  async receiveBrandingSyncFromPeer(
    slug: string,
    payload: {
      primary_color?: string;
      secondary_color?: string;
      logo_url?: string;
      company_name?: string;
      layout_preset?: string;
    },
    originEnv: string,
  ) {
    const branding = await this.prisma.emailBranding.findUnique({
      where: { business_unit: slug },
    });
    if (!branding) {
      this.logger.warn(
        `Branding sync received for unknown BU "${slug}" — ignored`,
      );
      return;
    }

    await this.prisma.emailBrandingHistory.create({
      data: {
        branding_id: branding.id,
        snapshot: {
          primary_color: branding.primary_color,
          secondary_color: branding.secondary_color,
          logo_url: branding.logo_url,
          company_name: branding.company_name,
          layout_preset: branding.layout_preset,
        },
        changed_by: 'sync',
      },
    });

    await this.prisma.emailBranding.update({
      where: { business_unit: slug },
      data: {
        ...(payload.primary_color !== undefined && {
          primary_color: payload.primary_color,
        }),
        ...(payload.secondary_color !== undefined && {
          secondary_color: payload.secondary_color,
        }),
        ...(payload.logo_url !== undefined && { logo_url: payload.logo_url }),
        ...(payload.company_name !== undefined && {
          company_name: payload.company_name,
        }),
        ...(payload.layout_preset !== undefined && {
          layout_preset: payload.layout_preset,
        }),
        updated_by: 'sync',
      },
    });

    this.logger.log(`Branding for "${slug}" synced from ${originEnv}`);
  }

  private async syncBrandingToPeer(
    slug: string,
    branding: {
      primary_color: string;
      secondary_color?: string | null;
      logo_url?: string | null;
      company_name: string;
      layout_preset: string;
    },
    userId: string,
  ) {
    const peerUrl = process.env.PEER_ENV_API_URL;
    const secret = process.env.INTER_ENV_SYNC_SECRET;
    const currentEnv = process.env.ENVIRONMENT ?? 'DEV';

    if (!peerUrl || !secret) return;

    await fetch(`${peerUrl}/business-units/${slug}/branding/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Secret': secret,
        'X-Sync-Origin': currentEnv,
        'X-Sync-By': userId,
      },
      body: JSON.stringify({
        primary_color: branding.primary_color,
        secondary_color: branding.secondary_color,
        logo_url: branding.logo_url,
        company_name: branding.company_name,
        layout_preset: branding.layout_preset,
      }),
    });

    this.logger.log(`Branding for "${slug}" synced to peer (${peerUrl})`);
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private async findOneOrThrow(slug: string) {
    const bu = await this.prisma.businessUnit.findUnique({ where: { slug } });
    if (!bu) throw new NotFoundException(`Business unit "${slug}" not found`);
    return bu;
  }
}
