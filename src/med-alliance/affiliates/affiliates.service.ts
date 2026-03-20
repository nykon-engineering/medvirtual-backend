import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { USER } from '@prisma/client';
import { CreateAffiliateProfileDto } from './dto/create-affiliate-profile.dto';
import {
  UpdateAffiliatePayoutPreferencesDto,
  UpdateAffiliateProfileDto,
} from './dto/update-affiliate-profile.dto';
import { ListAffiliatesDto } from './dto/list-affiliates.dto';

// Fields returned for the linked user — never expose password or sensitive tokens.
const USER_SELECT = {
  id: true,
  first_name: true,
  last_name: true,
  email: true,
  organization_id: true,
  role: true,
  status: true,
};

@Injectable()
export class AffiliatesService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Shared helper: ensure a user has an active AffiliateProfile.
  // Used by other services (commissions, payout-requests).
  // ---------------------------------------------------------------------------
  async requireActiveProfile(userId: string) {
    const profile = await this.prisma.affiliateProfile.findUnique({
      where: { user_id: userId },
    });
    if (!profile) {
      throw new ForbiddenException('Affiliate profile not found');
    }
    if (profile.status !== 'active') {
      throw new ForbiddenException('Affiliate profile is inactive');
    }
    return profile;
  }

  // ---------------------------------------------------------------------------
  // Admin: create a new affiliate profile for an existing user.
  // ---------------------------------------------------------------------------
  async create(dto: CreateAffiliateProfileDto, adminUser: USER) {
    // Ensure the target user exists.
    const user = await this.prisma.uSER.findUnique({
      where: { id: dto.user_id },
      select: USER_SELECT,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent duplicate profile — give a clear message before hitting DB constraint.
    const existing = await this.prisma.affiliateProfile.findUnique({
      where: { user_id: dto.user_id },
    });
    if (existing) {
      throw new ConflictException('This user already has an affiliate profile');
    }

    const profile = await this.prisma.affiliateProfile.create({
      data: {
        user_id: dto.user_id,
        hubspot_id: dto.hubspot_id ?? null,
        commission_percent_default: dto.commission_percent_default,
        payout_preference_method: dto.payout_preference_method ?? null,
        payout_preference_reference: dto.payout_preference_reference ?? null,
        payout_preference_notes: dto.payout_preference_notes ?? null,
        created_by: adminUser.id,
      },
      include: { user: { select: USER_SELECT } },
    });

    return profile;
  }

  // ---------------------------------------------------------------------------
  // Admin: list all affiliate profiles with optional filters.
  // ---------------------------------------------------------------------------
  async findAll(dto: ListAffiliatesDto) {
    const { page = 1, limit = 20, search, status, sortOrder = 'desc' } = dto;
    const skip = (page - 1) * limit;

    // Build where clause — search applies to the linked user's name/email.
    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.user = {
        OR: [
          { first_name: { contains: search, mode: 'insensitive' } },
          { last_name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.affiliateProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: sortOrder },
        include: { user: { select: USER_SELECT } },
      }),
      this.prisma.affiliateProfile.count({ where }),
    ]);

    return { data, pagination: { page, limit, total } };
  }

  // ---------------------------------------------------------------------------
  // Admin: get one profile by its ID.
  // ---------------------------------------------------------------------------
  async findOne(id: string) {
    const profile = await this.prisma.affiliateProfile.findUnique({
      where: { id },
      include: { user: { select: USER_SELECT } },
    });
    if (!profile) throw new NotFoundException('Affiliate profile not found');
    return profile;
  }

  // ---------------------------------------------------------------------------
  // Admin: update any field of an affiliate profile.
  // ---------------------------------------------------------------------------
  async update(id: string, dto: UpdateAffiliateProfileDto) {
    await this.findOne(id); // ensures it exists

    return this.prisma.affiliateProfile.update({
      where: { id },
      data: {
        ...(dto.commission_percent_default !== undefined && {
          commission_percent_default: dto.commission_percent_default,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.payout_preference_method !== undefined && {
          payout_preference_method: dto.payout_preference_method,
        }),
        ...(dto.payout_preference_reference !== undefined && {
          payout_preference_reference: dto.payout_preference_reference,
        }),
        ...(dto.payout_preference_notes !== undefined && {
          payout_preference_notes: dto.payout_preference_notes,
        }),
      },
      include: { user: { select: USER_SELECT } },
    });
  }

  // ---------------------------------------------------------------------------
  // Affiliate: get own profile.
  // ---------------------------------------------------------------------------
  async findOwn(currentUser: USER) {
    const profile = await this.prisma.affiliateProfile.findUnique({
      where: { user_id: currentUser.id },
      include: { user: { select: USER_SELECT } },
    });
    if (!profile) throw new NotFoundException('Affiliate profile not found');
    return profile;
  }

  // ---------------------------------------------------------------------------
  // Affiliate: update only payout preferences on own profile.
  // ---------------------------------------------------------------------------
  async updateOwn(currentUser: USER, dto: UpdateAffiliatePayoutPreferencesDto) {
    const profile = await this.requireActiveProfile(currentUser.id);

    return this.prisma.affiliateProfile.update({
      where: { id: profile.id },
      data: {
        ...(dto.payout_preference_method !== undefined && {
          payout_preference_method: dto.payout_preference_method,
        }),
        ...(dto.payout_preference_reference !== undefined && {
          payout_preference_reference: dto.payout_preference_reference,
        }),
        ...(dto.payout_preference_notes !== undefined && {
          payout_preference_notes: dto.payout_preference_notes,
        }),
      },
      include: { user: { select: USER_SELECT } },
    });
  }
}
