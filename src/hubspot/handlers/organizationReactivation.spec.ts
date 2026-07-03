import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OrganizationStatus } from '@prisma/client';
import { HandlerOrganizationReactivation } from './organizationReactivation';
import { PrismaService } from '../../prisma/prisma.service';

const prismaMock = {
  organization: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('HandlerOrganizationReactivation', () => {
  let handler: HandlerOrganizationReactivation;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HandlerOrganizationReactivation,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    handler = module.get<HandlerOrganizationReactivation>(
      HandlerOrganizationReactivation,
    );
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should return early and NOT update when the organization is not found', async () => {
    prismaMock.organization.findUnique.mockResolvedValue(null);

    await handler.execute({
      objectId: 999,
      propertyName: 'business_unit',
      propertyValue: 'MedVirtual',
    });

    expect(prismaMock.organization.update).not.toHaveBeenCalled();
  });

  it('should be a no-op when the organization status is active', async () => {
    prismaMock.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      status: OrganizationStatus.active,
    });

    await handler.execute({
      objectId: 1,
      propertyName: 'business_unit',
      propertyValue: 'MedVirtual',
    });

    expect(prismaMock.organization.update).not.toHaveBeenCalled();
  });

  it('should be a no-op when the organization status is inactive', async () => {
    prismaMock.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      status: OrganizationStatus.inactive,
    });

    await handler.execute({
      objectId: 1,
      propertyName: 'business_unit',
      propertyValue: 'MedVirtual',
    });

    expect(prismaMock.organization.update).not.toHaveBeenCalled();
  });

  it('should reactivate a deleted organization to inactive when business_unit is MedVirtual', async () => {
    prismaMock.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      status: OrganizationStatus.deleted,
    });
    prismaMock.organization.update.mockResolvedValue({});

    await handler.execute({
      objectId: 1,
      propertyName: 'business_unit',
      propertyValue: 'MedVirtual',
    });

    expect(prismaMock.organization.update).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      data: {
        status: OrganizationStatus.inactive,
        deletedAt: null,
        business_unit: 'MedVirtual',
      },
    });
  });

  it('should reactivate a deleted organization to inactive when business_unit is Berry Virtual', async () => {
    prismaMock.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      status: OrganizationStatus.deleted,
    });
    prismaMock.organization.update.mockResolvedValue({});

    await handler.execute({
      objectId: 1,
      propertyName: 'business_unit',
      propertyValue: 'Berry Virtual',
    });

    expect(prismaMock.organization.update).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      data: {
        status: OrganizationStatus.inactive,
        deletedAt: null,
        business_unit: 'Berry Virtual',
      },
    });
  });

  it('should wrap and rethrow update failures as BadRequestException', async () => {
    prismaMock.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      status: OrganizationStatus.deleted,
    });
    prismaMock.organization.update.mockRejectedValue(new Error('db down'));

    await expect(
      handler.execute({
        objectId: 1,
        propertyName: 'business_unit',
        propertyValue: 'MedVirtual',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
