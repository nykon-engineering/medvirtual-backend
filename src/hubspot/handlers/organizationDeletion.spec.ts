import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OrganizationStatus } from '@prisma/client';
import { HandlerOrganizationDeletion } from './organizationDeletion';
import { PrismaService } from '../../prisma/prisma.service';
import { OrgDeletionService } from '../../med-alliance/org-deletion/org-deletion.service';

const prismaMock = {
  organization: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  uSER: {
    updateMany: jest.fn(),
  },
};

const orgDeletionServiceMock = {
  onOrganizationDeleted: jest.fn(),
};

describe('HandlerOrganizationDeletion', () => {
  let handler: HandlerOrganizationDeletion;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HandlerOrganizationDeletion,
        { provide: PrismaService, useValue: prismaMock },
        { provide: OrgDeletionService, useValue: orgDeletionServiceMock },
      ],
    }).compile();

    handler = module.get<HandlerOrganizationDeletion>(
      HandlerOrganizationDeletion,
    );
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should return early when the organization is not found', async () => {
    prismaMock.organization.findUnique.mockResolvedValue(null);

    await handler.execute({ objectId: 999 });

    expect(prismaMock.organization.update).not.toHaveBeenCalled();
    expect(orgDeletionServiceMock.onOrganizationDeleted).not.toHaveBeenCalled();
  });

  it('should soft-delete the organization and deactivate its users', async () => {
    prismaMock.organization.findUnique.mockResolvedValue({ id: 'org-1' });
    prismaMock.uSER.updateMany.mockResolvedValue({ count: 2 });
    prismaMock.organization.update.mockResolvedValue({});
    orgDeletionServiceMock.onOrganizationDeleted.mockResolvedValue(undefined);

    await handler.execute({ objectId: 1 });

    expect(prismaMock.uSER.updateMany).toHaveBeenCalledWith({
      where: { organization_id: 'org-1' },
      data: { status: 'inactive' },
    });
    expect(prismaMock.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'org-1' },
        data: expect.objectContaining({
          status: OrganizationStatus.deleted,
        }),
      }),
    );
  });

  it('should run the Med Alliance deletion hook after soft-deleting the org', async () => {
    prismaMock.organization.findUnique.mockResolvedValue({ id: 'org-1' });
    prismaMock.uSER.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.organization.update.mockResolvedValue({});
    orgDeletionServiceMock.onOrganizationDeleted.mockResolvedValue(undefined);

    await handler.execute({ objectId: 1 });

    expect(orgDeletionServiceMock.onOrganizationDeleted).toHaveBeenCalledWith(
      'org-1',
    );
  });

  it('should wrap failures as BadRequestException', async () => {
    prismaMock.organization.findUnique.mockResolvedValue({ id: 'org-1' });
    prismaMock.uSER.updateMany.mockRejectedValue(new Error('db down'));

    await expect(handler.execute({ objectId: 1 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
