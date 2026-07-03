import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { HubspotService } from '../hubspot/hubspot.service';

describe('UserService', () => {
  let service: UserService;

  const prismaMock = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    uSER: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
    emailInvitation: {
      create: jest.fn(),
    },
    // Resolve the array of query promises just like a real interactive transaction
    $transaction: jest.fn((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
  };

  const mailServiceMock = {
    sendMail: jest.fn(),
  };

  const hubspotServiceMock = {
    createContactInHubspot: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: MailService, useValue: mailServiceMock },
        { provide: HubspotService, useValue: hubspotServiceMock },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('inviteUserToOrganization', () => {
    const currentUser: any = { id: 'admin-1', role: 'system_admin' };
    const inviteData: any = { email: 'new@test.com', role: 'organization_admin' };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should throw BadRequestException when inviting user to an inactive organization', async () => {
      prismaMock.uSER.findUnique.mockResolvedValue(null);
      prismaMock.organization.findUnique.mockResolvedValue({
        id: 'org-1',
        name: 'Test Org',
        status: 'inactive',
      });

      await expect(
        service.inviteUserToOrganization('org-1', inviteData, currentUser),
      ).rejects.toThrow(
        new BadRequestException('Cannot invite users to an inactive organization'),
      );
    });

    it('should throw NotFoundException when organization does not exist', async () => {
      prismaMock.uSER.findUnique.mockResolvedValue(null);
      prismaMock.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.inviteUserToOrganization('org-missing', inviteData, currentUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when user email already exists', async () => {
      prismaMock.uSER.findUnique.mockResolvedValue({ id: 'existing-user' });

      await expect(
        service.inviteUserToOrganization('org-1', inviteData, currentUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAllSystemUsers', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should apply the status filter to both findMany and count so meta.total reflects the filtered set', async () => {
      const invitedUsers = [
        {
          id: 'u1',
          email: 'invited@test.com',
          first_name: 'Inv',
          last_name: 'Ited',
          job_title: 'Admin',
          role: 'system_admin',
          status: 'invited',
          createdAt: new Date(),
          sessions: [],
        },
      ];
      prismaMock.uSER.findMany.mockResolvedValue(invitedUsers);
      prismaMock.uSER.count.mockResolvedValue(1);

      const result = await service.getAllSystemUsers(
        undefined,
        1,
        10,
        'invited',
      );

      // The where clause passed to findMany must include the status filter
      const findManyArgs = prismaMock.uSER.findMany.mock.calls[0][0];
      expect(findManyArgs.where.status).toBe('invited');

      // The where clause passed to count must include the same status filter,
      // otherwise meta.total would count the unfiltered set and break pagination
      const countArgs = prismaMock.uSER.count.mock.calls[0][0];
      expect(countArgs.where.status).toBe('invited');

      expect(result.meta.total).toBe(1);
      expect(result.data).toEqual(invitedUsers);
    });

    it('should NOT apply any status filter when status is omitted (no regression)', async () => {
      prismaMock.uSER.findMany.mockResolvedValue([
        {
          id: 'u1',
          email: 'a@test.com',
          first_name: 'A',
          last_name: 'B',
          job_title: 'Admin',
          role: 'system_admin',
          status: 'active',
          createdAt: new Date(),
          sessions: [],
        },
      ]);
      prismaMock.uSER.count.mockResolvedValue(1);

      await service.getAllSystemUsers();

      const findManyArgs = prismaMock.uSER.findMany.mock.calls[0][0];
      expect(findManyArgs.where.status).toBeUndefined();

      const countArgs = prismaMock.uSER.count.mock.calls[0][0];
      expect(countArgs.where.status).toBeUndefined();
    });
  });
});
