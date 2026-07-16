import { Test, TestingModule } from '@nestjs/testing';
import { TicketService } from './ticket.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Priority } from '@prisma/client';
import { ticketTypeDictionary } from '../common/dictionaries/ticket-type';

const userfake = {
  id: '1',
  organization_id: 'org1',
  role: 'organization_admin',
  email: 'test@test.com',
  password: '',
  organization_name: 'Default Organization',
  first_name: 'John',
  last_name: 'Doe',
  phone: '',
  avatar: '',
  job_title: '',
  workos_id: '',
  authentication_method: 'OwnSign',
  status: 'active',
  is_organization_owner: false,
  verified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdByMethod: 'self_signup',
  createdByUserId: null,
  hubspot_id: '1',
  hubspot_contact_id: '1',
  status_before_deactivation: null,
  activatedAt: null,
  billcom_session_id: null,
  billcom_session_expires: null,
  billcom_pending_session_id: null,
  billcom_remember_me_id: null,
  billcom_device: null,
}

const systemAdminUser = { ...userfake, id: 'admin1', role: 'system_admin', organization_id: null };
const systemSuperAdminUser = { ...userfake, id: 'sadmin1', role: 'system_super_admin', organization_id: null };
const orgSuperAdminUser = { ...userfake, id: 'osa1', role: 'organization_super_admin', organization_id: 'org1' };

describe('TicketService', () => {
  let service: TicketService;
  let prisma: PrismaService;

  const mockPrisma = {
    ticket: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    uSER:{
      findUnique: jest.fn(),
    },
    staff :{
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    candidate: {
      findUnique: jest.fn(),
    },
    hireRequest: {
      findUnique: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
    $executeRawUnsafe: jest.fn(),
    $queryRawUnsafe: jest.fn(),
    $transaction: jest.fn(),
  }

  const mockNotificationsService = {
    sendNotification: jest.fn(),
    createNotification: jest.fn(),
    getNotifications: jest.fn(),
    markAsRead: jest.fn(),
    deleteNotification: jest.fn(),
    notifyTicketEvent: jest.fn(),
    notifyTicketStatusChangeToCreator: jest.fn(),
    notifyTicketReopened: jest.fn(),
    notifyTicketNoteAddedToAssignee: jest.fn(),
    notifyTicketNoteAddedToCreator: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TicketService,
        {provide: PrismaService, useValue: mockPrisma},
        {provide: NotificationsService, useValue: mockNotificationsService}
      ],
    }).compile();

    service = module.get<TicketService>(TicketService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe.skip('Create', () => {
    const dto = {
      client_id: 'client1',
      type: 'issue',
      title: 'Ticket title',
      description: 'Ticket description',
      priority: 'HIGH' as Priority,
      assigned_user_id: ['user1'],
    };
  
    const mockTicket = { id: '1', ...dto, type: ticketTypeDictionary[dto.type] ?? null };
    const mockTicketFull = { id: '1', title: 'Ticket title', status: 'open' };
  
    beforeEach(() => {
      jest.clearAllMocks();
      (service as any).findOne = jest.fn().mockResolvedValue(mockTicketFull);
    });
  
    it('should create a ticket successfully and return full ticket', async () => {
      mockPrisma.ticket.create.mockResolvedValue(mockTicket);
  
      const result = await service.create(dto, userfake);
  
      expect(result).toEqual(mockTicketFull);
      expect(mockPrisma.ticket.create).toHaveBeenCalledWith({
        data: {
          organization: { connect: { id: dto.client_id } },
          type: ticketTypeDictionary[dto.type] ?? null,
          title: dto.title,
          description: dto.description,
          priority: dto.priority,
          user: { connect: { id: dto.assigned_user_id } },
        },
      });
      expect((service as any).findOne).toHaveBeenCalledWith('1');
    });
  
    it('should create a ticket with type=null if type is invalid', async () => {
      const dtoInvalidType = { ...dto, type: 'invalid_type' };
      const mockTicketInvalid = { id: '2', ...dtoInvalidType, type: null };
      mockPrisma.ticket.create.mockResolvedValue(mockTicketInvalid);
  
      const result = await service.create(dtoInvalidType, userfake);
  
      expect(result).toEqual(mockTicketFull);
      expect(mockPrisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: null }),
        }),
      );
    });
  
    it('should create a ticket without assigned user', async () => {
      const dtoNoUser = { ...dto, assigned_user_id: [''] };
      const mockTicketNoUser = { id: '3', ...dtoNoUser, type: ticketTypeDictionary[dto.type] ?? null };
      mockPrisma.ticket.create.mockResolvedValue(mockTicketNoUser);
  
      const result = await service.create(dtoNoUser, userfake);
  
      expect(result).toEqual(mockTicketFull);
      expect(mockPrisma.ticket.create).toHaveBeenCalledWith({
        data: {
          organization: { connect: { id: dto.client_id } },
          type: ticketTypeDictionary[dto.type] ?? null,
          title: dto.title,
          description: dto.description,
          priority: dto.priority,
          user: undefined,
        },
      });
    });
  
    it('should throw BadRequestException if ticket is null', async () => {
      mockPrisma.ticket.create.mockResolvedValue(null);
  
      await expect(service.create(dto, userfake)).rejects.toThrow(BadRequestException);
    });
  
    it('should throw BadRequestException if Prisma throws error', async () => {
      mockPrisma.ticket.create.mockRejectedValue(new Error('DB error'));
  
      await expect(service.create(dto, userfake)).rejects.toThrow(BadRequestException);
    });
  
    it('should throw BadRequestException if findOne returns null', async () => {
      mockPrisma.ticket.create.mockResolvedValue(mockTicket);
      (service as any).findOne = jest.fn().mockResolvedValue(null);
  
      await expect(service.create(dto, userfake)).rejects.toThrow(BadRequestException);
    });
  });
  
  
  describe('findAll', () => {
    const mockTickets = [{ id: 1, title: 'Ticket 1', candidate: null, staff: null  }];
  
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    it('should return all tickets without filters', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue(mockTickets);
  
      const result = await service.findAll(userfake, undefined, undefined, undefined, undefined);
  
      expect(result).toEqual(mockTickets);
      
      // Calculate expected 30 days ago date for comparison
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith({
        where: {
          type: undefined,
          priority: undefined,
          created_by: "1",
          // Exclude tickets that are closed and were last updated more than 30 days ago
          NOT: {
            AND: [
              { status: 'closed' },
              { updatedAt: { lt: expect.any(Date) } }
            ]
          }
        },
        select:{
          id: true,
          type: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          createdAt: true,
          created_by: true,
          createdBy: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              job_title: true,
              role: true,
              status: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
              email: true,
              business_unit: true,
              status: true,
              admin_id: true,
            }
          },
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              job_title: true,
              role: true,
              status: true,
              email: true,
            }
          },
          candidate: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              name: true,
              gender: true,
              avatar_url: true,
            }
          },
          staff: {
            select: {
              id: true,
              status: true,
              start_date: true,
              terminated_date: true,
              candidate: {
                select: {
                  id: true,
                  first_name: true,
                  last_name: true,
                  email: true,
                  name: true,
                  specialization: true,
                  years_of_experience: true,
                  gender: true,
                  avatar_url: true,
                }
              }
            }
          },
          offerPanel: {
            select: {
              id: true,
              title: true,
              description: true,
              status: true,
              business_unit: true,
              recipient_name: true,
              recipient_email: true,
              recipient_org_name: true,
              recipient_type: true,
              view_count: true,
              viewed_at: true,
              decided_at: true,
              public_token: true,
              is_public: true,
              createdAt: true,
            },
          },
        }
      });
    });
  
    it('should apply type filter', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue(mockTickets);
  
      await service.findAll(userfake, 'bug', undefined, undefined, undefined);
  
      expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'bug' }),
        }),
      );
    });
  
    it('should apply priority filter', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue(mockTickets);
  
      await service.findAll(userfake, undefined, 'high', undefined, undefined);
  
      expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ priority: 'high' }),
        }),
      );
    });
  
    it('should apply assigned_user_id filter', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue(mockTickets);
  
      await service.findAll(userfake, undefined, undefined, 'user-123', undefined);
  
      expect(mockPrisma.ticket.findMany).toHaveBeenCalled();
    });
  
    it('should apply search filter to organization and title', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue(mockTickets);
  
      await service.findAll(userfake, undefined, undefined, undefined, 'test');
  
      expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { organization: { name: { contains: 'test', mode: 'insensitive' } } },
              { title: { contains: 'test', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });
  
    it('should throw BadRequestException if tickets is null', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue(null);
  
      await expect(
        service.findAll(userfake, undefined, undefined, undefined, undefined),
      ).rejects.toThrow(BadRequestException);
    });
  
    it('should throw BadRequestException if Prisma findMany fails', async () => {
      mockPrisma.ticket.findMany.mockRejectedValue(new Error('DB error'));
  
      await expect(
        service.findAll(userfake, undefined, undefined, undefined, undefined),
      ).rejects.toThrow(BadRequestException);
    });
  });
  
  describe('reassign', () => {
    const dto = { assigned_user_id: 'user1' };
    const ticketId = 'ticket123';
    const currentTicketmock = { status: 'open' };
    const mockTicketUpdated = { id: ticketId };
    const mockTicketFinal = {
      id: ticketId,
      organization: { id: 'org1', name: 'Org 1' },
      user: {
        id: 'user1',
        first_name: 'John',
        last_name: 'Doe',
        job_title: 'Dev',
        role: 'Admin',
        status: 'ACTIVE',
        email: 'john@example.com',
      },
    };
  
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    it('should throw BadRequestException if ticket not found', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValueOnce(null);
  
      await expect(service.reassing(ticketId, dto)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.ticket.findUnique).toHaveBeenCalledWith({
        where: { id: ticketId },
        select: { status: true },
      });
    });
  
    it('should throw BadRequestException if reassigning to unassigned for non-new ticket', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValueOnce({ status: 'open' });
  
      await expect(service.reassing(ticketId, { assigned_user_id: '' })).rejects.toThrow(
        BadRequestException,
      );
    });
  
    it('should throw BadRequestException if ticket update fails', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValueOnce(currentTicketmock);
      mockPrisma.ticket.update.mockResolvedValueOnce(null);
  
      await expect(service.reassing(ticketId, dto)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.ticket.update).toHaveBeenCalledWith({
        where: { id: ticketId },
        data: { user: { connect: { id: dto.assigned_user_id } } },
      });
    });
  
    it('should throw BadRequestException if fetching reassigned ticket fails', async () => {
      // 1ª chamada: currentTicket
      // 2ª chamada: findOne -> retorna null
      mockPrisma.ticket.findUnique
        .mockImplementationOnce(() => Promise.resolve(currentTicketmock))
        .mockImplementationOnce(() => Promise.resolve(null));
      
      mockPrisma.ticket.update.mockResolvedValueOnce(mockTicketUpdated);
  
      await expect(service.reassing(ticketId, dto)).rejects.toThrow(BadRequestException);
    });
  
    it('should reassign ticket successfully', async () => {
      mockPrisma.ticket.findUnique
        .mockImplementationOnce(() => Promise.resolve(currentTicketmock)) // currentTicket
        .mockImplementationOnce(() => Promise.resolve(mockTicketFinal)); // findOne
  
      mockPrisma.ticket.update.mockResolvedValueOnce(mockTicketUpdated);
  
      const result = await service.reassing(ticketId, dto);
  
      expect(result).toEqual(mockTicketFinal);
      expect(mockPrisma.ticket.update).toHaveBeenCalledWith({
        where: { id: ticketId },
        data: { user: { connect: { id: dto.assigned_user_id } } },
      });
    });
  
    it('should throw BadRequestException if Prisma throws error', async () => {
      mockPrisma.ticket.findUnique.mockRejectedValueOnce(new Error('DB error'));
  
      await expect(service.reassing(ticketId, dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateStatus', () => {
    const ticketId = 'ticket123';
    const newStatus = 'in_progress';
    const mockTicketUpdated = { id: ticketId, status: newStatus };
    const mockTicketFinal = {
      id: 'ticket123',
      status: 'in_progress',
      type: 'termination',
      staff: { id: 'staff1' },
      user: { id: 'user1' },
    };
    
  
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    it('should throw if ticket not found', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(null);
  
      await expect(service.updateStatus(ticketId, { status: newStatus }))
        .rejects.toThrow('Ticket not found');
    });
  
    it('should throw if status is the same', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({ status: newStatus });
  
      await expect(service.updateStatus(ticketId, { status: newStatus }))
        .rejects.toThrow(`Ticket is already in status: ${newStatus}`);
    });
  
    it('should throw if changing from closed to resolved', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({ status: 'closed' });
  
      await expect(service.updateStatus(ticketId, { status: 'resolved' }))
        .rejects.toThrow('Cannot change status from CLOSED to RESOLVED');
    });
  
    it('should throw if going new→in_progress without assigned user', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({ status: 'new', user: null });
  
      await expect(service.updateStatus(ticketId, { status: 'in_progress' }))
        .rejects.toThrow('Please assign a user to the ticket before changing status to IN PROGRESS');
    });
  
    it('should throw if going new→resolved without assigned user', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({ status: 'new', user: null });
  
      await expect(service.updateStatus(ticketId, { status: 'resolved' }))
        .rejects.toThrow('Please assign a user to the ticket before changing status to RESOLVED');
    });
  
    it('should terminate staff when resolving termination ticket', async () => {
      mockPrisma.ticket.findUnique
        .mockResolvedValueOnce({
          status: 'open',
          type: 'termination',
          staff: { id: 'staff1' },
          user: { id: 'user1' },
        })
        .mockResolvedValueOnce(mockTicketFinal);
      mockPrisma.staff.update.mockResolvedValue({ id: 'staff1', status: 'terminated' });
      mockPrisma.ticket.update.mockResolvedValue(mockTicketUpdated);
  
      const result = await service.updateStatus(ticketId, { status: 'resolved' });
  
      expect(mockPrisma.staff.update).toHaveBeenCalledWith({
        where: { id: 'staff1' },
        data: expect.objectContaining({ status: 'terminated' }),
      });
      expect(result).toEqual(mockTicketFinal);
    });
  
    it('should throw if ticket update returns null', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({ status: 'open', user: { id: 'u1' } });
      mockPrisma.ticket.update.mockResolvedValue(null);
  
      await expect(service.updateStatus(ticketId, { status: newStatus }))
        .rejects.toThrow('Error updating ticket status');
    });
  
    it('should throw if findOne returns null after update', async () => {
      mockPrisma.ticket.findUnique
        .mockResolvedValueOnce({ status: 'open', user: { id: 'u1' } }) 
        .mockResolvedValueOnce(null);
      mockPrisma.ticket.update.mockResolvedValue(mockTicketUpdated);
  
      await expect(service.updateStatus(ticketId, { status: newStatus }))
        .rejects.toThrow('Error updating ticket status');
    });
  
    it('should update ticket successfully', async () => {
      mockPrisma.ticket.findUnique
        .mockResolvedValueOnce({ status: 'open', user: { id: 'u1' } })
        .mockResolvedValueOnce({ id: ticketId, status: newStatus, user: { id: 'u1' } });

      mockPrisma.ticket.update.mockResolvedValue(mockTicketUpdated);
  
      const result = await service.updateStatus(ticketId, { status: newStatus });
  
      expect(result).toMatchObject({
        id: 'ticket123',
        status: 'in_progress',
      });
      expect(mockPrisma.ticket.update).toHaveBeenCalledWith({
        where: { id: ticketId },
        data: { status: newStatus },
      });
    });
  
    it('should throw BadRequestException if Prisma throws error', async () => {
      // ticket encontrado normalmente
      mockPrisma.ticket.findUnique.mockResolvedValue({ id: ticketId, status: 'open' });

      // mas update falha
      mockPrisma.ticket.update.mockRejectedValue(new Error('DB error'));

      await expect(service.updateStatus(ticketId, { status: newStatus }))
        .rejects.toThrow('Error updating ticket status');
    });

    it('should notify status change to in_progress', async () => {
      mockPrisma.ticket.findUnique
        .mockResolvedValueOnce({ status: 'open', user: { id: 'u1' } })
        .mockResolvedValueOnce({ id: ticketId, status: 'in_progress' });
      mockPrisma.ticket.update.mockResolvedValue({ id: ticketId, status: 'in_progress' });
      mockNotificationsService.notifyTicketStatusChangeToCreator.mockResolvedValue(undefined);

      await service.updateStatus(ticketId, { status: 'in_progress' });

      expect(mockNotificationsService.notifyTicketStatusChangeToCreator).toHaveBeenCalledWith(
        expect.anything(),
        'in_progress',
      );
    });

    it('should notify ticket reopened when transitioning from closed to new', async () => {
      mockPrisma.ticket.findUnique
        .mockResolvedValueOnce({ status: 'closed', user: { id: 'u1' } })
        .mockResolvedValueOnce({ id: ticketId, status: 'new' });
      mockPrisma.ticket.update.mockResolvedValue({ id: ticketId, status: 'new' });
      mockNotificationsService.notifyTicketReopened.mockResolvedValue(undefined);

      await service.updateStatus(ticketId, { status: 'new' });

      expect(mockNotificationsService.notifyTicketReopened).toHaveBeenCalled();
    });

    it('should swallow notification errors without failing', async () => {
      mockPrisma.ticket.findUnique
        .mockResolvedValueOnce({ status: 'open', user: { id: 'u1' } })
        .mockResolvedValueOnce({ id: ticketId, status: 'resolved' });
      mockPrisma.ticket.update.mockResolvedValue({ id: ticketId, status: 'resolved' });
      mockNotificationsService.notifyTicketStatusChangeToCreator.mockRejectedValue(new Error('mail error'));

      await expect(service.updateStatus(ticketId, { status: 'resolved' })).resolves.toBeDefined();
    });
  });

  describe('findOne', () => {
    const ticketId = 'ticket1';
    const baseTicket = {
      id: ticketId,
      type: 'support',
      title: 'Test',
      description: 'desc',
      status: 'open',
      priority: 'HIGH',
      createdAt: new Date(),
      created_by: '1',
      organization: { id: 'org1', name: 'Org', email: 'o@o.com', business_unit: 'MedVirtual', status: 'active', admin_id: 'a1' },
      user: null,
      createdBy: null,
      candidate: null,
      staff: null,
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return a ticket by id without user access check', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(baseTicket);

      const result = await service.findOne(ticketId);

      expect(result).toEqual(baseTicket);
      expect(mockPrisma.ticket.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ticketId } }),
      );
    });

    it('should throw BadRequestException when ticket not found', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(null);

      await expect(service.findOne(ticketId)).rejects.toThrow(BadRequestException);
    });

    it('should allow organization_admin to view their own ticket', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({ ...baseTicket, created_by: '1' });

      const result = await service.findOne(ticketId, userfake as any);

      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException when organization_admin views another users ticket', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({ ...baseTicket, created_by: 'other-user' });

      await expect(service.findOne(ticketId, userfake as any)).rejects.toThrow(ForbiddenException);
    });

    it('should allow organization_super_admin to view ticket from their org', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        ...baseTicket,
        created_by: 'other-user',
        organization: { ...baseTicket.organization, id: 'org1' },
      });

      const result = await service.findOne(ticketId, orgSuperAdminUser as any);

      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException when organization_super_admin views ticket from different org', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        ...baseTicket,
        created_by: 'other-user',
        organization: { ...baseTicket.organization, id: 'other-org' },
      });

      await expect(service.findOne(ticketId, orgSuperAdminUser as any)).rejects.toThrow(ForbiddenException);
    });

    it('should allow system admin to view any ticket', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({ ...baseTicket, created_by: 'other-user' });

      const result = await service.findOne(ticketId, systemAdminUser as any);

      expect(result).toBeDefined();
    });
  });

  describe('create', () => {
    const baseDto = {
      type: 'Support',
      title: 'Test Ticket',
      description: 'Test description',
      priority: 'HIGH' as Priority,
      client_id: 'org1',
      assigned_user_id: ['user1'],
    };

    const mockCreatedTicket = { id: 'ticket-new' };
    const mockFullTicket = { id: 'ticket-new', type: 'support', title: 'Test Ticket', status: 'open' };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should throw BadRequestException when Interview Request has no candidate_id', async () => {
      await expect(
        service.create({ ...baseDto, type: 'Interview Request' } as any, userfake as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when Bonus ticket has no staff_id', async () => {
      await expect(
        service.create({ ...baseDto, type: 'Bonus' } as any, userfake as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when Termination ticket has no staff_id', async () => {
      await expect(
        service.create({ ...baseDto, type: 'Termination' } as any, userfake as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when hire_request_cancellation has no hireRequest_id', async () => {
      await expect(
        service.create({ ...baseDto, type: 'hire_request_cancellation' } as any, userfake as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when candidate_id provided but candidate not found', async () => {
      mockPrisma.candidate.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ ...baseDto, type: 'Interview Request', candidate_id: 'cand1' } as any, userfake as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when staff_id provided but staff not found', async () => {
      mockPrisma.staff.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ ...baseDto, type: 'Bonus', staff_id: 'staff1' } as any, userfake as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when staff belongs to different org for organization user', async () => {
      mockPrisma.staff.findUnique.mockResolvedValue({
        id: 'staff1',
        hireRequest: { org_id: 'other-org' },
      });

      await expect(
        service.create({ ...baseDto, type: 'Bonus', staff_id: 'staff1' } as any, userfake as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when hireRequest_id provided but hireRequest not found', async () => {
      mockPrisma.hireRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ ...baseDto, type: 'hire_request_cancellation', hireRequest_id: 'hr1' } as any, userfake as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when organization_admin user has no organization_id', async () => {
      const userNoOrg = { ...userfake, organization_id: null, role: 'organization_admin' };

      await expect(
        service.create({ type: 'Termination', title: 'T', description: 'D', priority: 'HIGH' as Priority, staff_id: 's1' } as any, userNoOrg as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when organization not found for org user', async () => {
      const orgUserDto = { type: 'Termination', title: 'T', description: 'D', priority: 'HIGH' as Priority, staff_id: 'staff1' };
      mockPrisma.staff.findUnique.mockResolvedValue({ id: 'staff1', hireRequest: { org_id: 'org1' } });
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.create(orgUserDto as any, userfake as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when creator user not found', async () => {
      mockPrisma.uSER.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.create(baseDto as any, userfake as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when assigned user not found', async () => {
      mockPrisma.uSER.findUnique
        .mockResolvedValueOnce({ id: '1' })
        .mockResolvedValueOnce(null);

      await expect(
        service.create(baseDto as any, userfake as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create Support ticket successfully for system_admin', async () => {
      mockPrisma.uSER.findUnique
        .mockResolvedValueOnce({ id: 'admin1' })
        .mockResolvedValueOnce({ id: 'user1' });
      mockPrisma.ticket.create.mockResolvedValue(mockCreatedTicket);
      mockPrisma.ticket.findUnique.mockResolvedValue(mockFullTicket);
      mockNotificationsService.notifyTicketEvent.mockResolvedValue(undefined);

      const result = await service.create(baseDto as any, systemAdminUser as any);

      expect(result).toEqual(mockFullTicket);
      expect(mockPrisma.ticket.create).toHaveBeenCalled();
    });

    it('should create ticket for organization_admin using org admin_id as assignee', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org1', admin_id: 'admin1' });
      mockPrisma.uSER.findUnique
        .mockResolvedValueOnce({ id: '1' })
        .mockResolvedValueOnce({ id: 'admin1' });
      mockPrisma.ticket.create.mockResolvedValue(mockCreatedTicket);
      mockPrisma.ticket.findUnique.mockResolvedValue(mockFullTicket);
      mockNotificationsService.notifyTicketEvent.mockResolvedValue(undefined);

      const result = await service.create(
        { type: 'Termination', title: 'T', description: 'D', priority: 'HIGH' as Priority, staff_id: 's1' } as any,
        { ...userfake, role: 'organization_admin' } as any,
      );

      expect(result).toBeDefined();
    });

    it('should swallow notification error and still return ticket', async () => {
      mockPrisma.uSER.findUnique
        .mockResolvedValueOnce({ id: 'admin1' })
        .mockResolvedValueOnce({ id: 'user1' });
      mockPrisma.ticket.create.mockResolvedValue(mockCreatedTicket);
      mockPrisma.ticket.findUnique.mockResolvedValue(mockFullTicket);
      mockNotificationsService.notifyTicketEvent.mockRejectedValue(new Error('mail error'));

      const result = await service.create(baseDto as any, systemAdminUser as any);

      expect(result).toEqual(mockFullTicket);
    });
  });

  describe('findAll role branches', () => {
    const mockTickets = [{ id: '1', title: 'T', candidate: null, staff: null }];

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should apply no user filter for system_super_admin', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue(mockTickets);

      await service.findAll(systemSuperAdminUser as any, undefined, undefined, undefined, undefined);

      const call = mockPrisma.ticket.findMany.mock.calls[0][0];
      expect(call.where).not.toHaveProperty('created_by');
      expect(call.where).not.toHaveProperty('OR');
    });

    it('should filter by assigned or created for system_admin', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue(mockTickets);

      await service.findAll(systemAdminUser as any, undefined, undefined, undefined, undefined);

      const call = mockPrisma.ticket.findMany.mock.calls[0][0];
      expect(call.where.OR).toBeDefined();
    });

    it('should filter by organization for organization_super_admin', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue(mockTickets);

      await service.findAll(orgSuperAdminUser as any, undefined, undefined, undefined, undefined);

      const call = mockPrisma.ticket.findMany.mock.calls[0][0];
      expect(call.where.organization).toBeDefined();
    });

    it('should map avatar_url for candidate in results', async () => {
      const ticketsWithCandidate = [{
        id: '1',
        title: 'T',
        candidate: { id: 'c1', avatar_url: 'avatar.png' },
        staff: null,
      }];
      process.env.AVATAR_URL = 'https://cdn.example.com/';
      mockPrisma.ticket.findMany.mockResolvedValue(ticketsWithCandidate);

      const result = await service.findAll(userfake as any, undefined, undefined, undefined, undefined) as any[];

      expect(result[0].candidate.avatar).toBe('https://cdn.example.com/avatar.png');
    });

    it('should map staff candidate avatar_url', async () => {
      const ticketsWithStaff = [{
        id: '1',
        title: 'T',
        candidate: null,
        staff: { id: 's1', candidate: { avatar_url: 'staff-avatar.png' } },
      }];
      process.env.AVATAR_URL = 'https://cdn.example.com/';
      mockPrisma.ticket.findMany.mockResolvedValue(ticketsWithStaff);

      const result = await service.findAll(userfake as any, undefined, undefined, undefined, undefined) as any[];

      expect(result[0].staff.candidate.avatar).toBe('https://cdn.example.com/staff-avatar.png');
    });
  });

  describe('delete', () => {
    const ticketId = 'ticket1';

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should throw BadRequestException for non-system admin users', async () => {
      await expect(service.delete(ticketId, userfake as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when ticket not found', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(null);

      await expect(service.delete(ticketId, systemAdminUser as any)).rejects.toThrow(BadRequestException);
    });

    it('should delete ticket successfully', async () => {
      const ticketRecord = { id: ticketId, status: 'open', type: 'support', staff_id: 'staff1', created_by: 'user1', description: 'desc' };
      mockPrisma.ticket.findUnique.mockResolvedValue(ticketRecord);
      mockPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        const txPrisma = {
          ticket: { delete: jest.fn().mockResolvedValue({ id: ticketId }) },
          bonus: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        };
        return cb(txPrisma);
      });

      const result = await service.delete(ticketId, systemAdminUser as any) as any;

      expect(result.message).toBe('Ticket deleted successfully');
      expect(result.deletedTicket.id).toBe(ticketId);
    });

    it('should throw BadRequestException when prisma delete fails', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({ id: ticketId, status: 'open', type: 'support', staff_id: null, created_by: 'user1', description: null });
      mockPrisma.$transaction.mockRejectedValue(new Error('DB error'));

      await expect(service.delete(ticketId, systemAdminUser as any)).rejects.toThrow(BadRequestException);
    });

    it('should allow system_super_admin to delete', async () => {
      const ticketRecord = { id: ticketId, status: 'open', type: 'support', staff_id: null, created_by: 'user1', description: null };
      mockPrisma.ticket.findUnique.mockResolvedValue(ticketRecord);
      mockPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        const txPrisma = {
          ticket: { delete: jest.fn().mockResolvedValue({ id: ticketId }) },
          bonus: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        };
        return cb(txPrisma);
      });

      const result = await service.delete(ticketId, systemSuperAdminUser as any) as any;

      expect(result.message).toBe('Ticket deleted successfully');
    });
  });

  describe('update', () => {
    const ticketId = 'ticket1';
    const baseTicketRecord = { id: ticketId, created_by: '1', organization: { id: 'org1' } };
    const updatedTicket = { id: ticketId, title: 'Updated', status: 'open' };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should throw when ticket not found', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.update(ticketId, { title: 'New Title' }, systemAdminUser as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when organization_admin updates ticket they did not create', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValueOnce({ ...baseTicketRecord, created_by: 'other-user' });

      await expect(
        service.update(ticketId, { title: 'New' }, userfake as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when organization_super_admin updates ticket from different org', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValueOnce({
        ...baseTicketRecord,
        created_by: 'other-user',
        organization: { id: 'other-org' },
      });

      await expect(
        service.update(ticketId, { title: 'New' }, orgSuperAdminUser as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return findOne result when no updatable fields provided by system_admin', async () => {
      mockPrisma.ticket.findUnique
        .mockResolvedValueOnce(baseTicketRecord)
        .mockResolvedValueOnce(updatedTicket);

      const result = await service.update(ticketId, {}, systemAdminUser as any);

      expect(result).toEqual(updatedTicket);
      expect(mockPrisma.ticket.update).not.toHaveBeenCalled();
    });

    it('should update title and description for organization_admin', async () => {
      mockPrisma.ticket.findUnique
        .mockResolvedValueOnce(baseTicketRecord)
        .mockResolvedValueOnce(updatedTicket);
      mockPrisma.ticket.update.mockResolvedValue(updatedTicket);
      mockNotificationsService.notifyTicketEvent.mockResolvedValue(undefined);

      const result = await service.update(ticketId, { title: 'New Title', description: 'New Desc' }, userfake as any);

      expect(result).toEqual(updatedTicket);
      expect(mockPrisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: 'New Title', description: 'New Desc' }),
        }),
      );
    });

    it('should throw BadRequestException for invalid ticket type when system_admin updates', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValueOnce(baseTicketRecord);

      await expect(
        service.update(ticketId, { type: 'invalid_type' }, systemAdminUser as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when org not found during system_admin update with client_id', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValueOnce(baseTicketRecord);
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.update(ticketId, { client_id: 'bad-org' }, systemAdminUser as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when assigned user not found during system_admin update', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValueOnce(baseTicketRecord);
      mockPrisma.uSER.findUnique.mockResolvedValue(null);

      await expect(
        service.update(ticketId, { assigned_user_id: 'bad-user' }, systemAdminUser as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update type, client_id, and assigned_user_id for system_admin', async () => {
      mockPrisma.ticket.findUnique
        .mockResolvedValueOnce(baseTicketRecord)
        .mockResolvedValueOnce(updatedTicket);
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org2' });
      mockPrisma.uSER.findUnique.mockResolvedValue({ id: 'user2' });
      mockPrisma.ticket.update.mockResolvedValue(updatedTicket);
      mockNotificationsService.notifyTicketEvent.mockResolvedValue(undefined);

      const result = await service.update(
        ticketId,
        { type: 'Support', client_id: 'org2', assigned_user_id: 'user2' },
        systemAdminUser as any,
      );

      expect(result).toEqual(updatedTicket);
      expect(mockPrisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'support',
            organization: { connect: { id: 'org2' } },
            user: { connect: { id: 'user2' } },
          }),
        }),
      );
    });

    it('should swallow notification error and still return updated ticket', async () => {
      mockPrisma.ticket.findUnique
        .mockResolvedValueOnce(baseTicketRecord)
        .mockResolvedValueOnce(updatedTicket);
      mockPrisma.ticket.update.mockResolvedValue(updatedTicket);
      mockNotificationsService.notifyTicketEvent.mockRejectedValue(new Error('mail error'));

      const result = await service.update(ticketId, { title: 'X' }, userfake as any);

      expect(result).toEqual(updatedTicket);
    });

    it('should allow organization_super_admin to update their own orgs ticket', async () => {
      mockPrisma.ticket.findUnique
        .mockResolvedValueOnce({ ...baseTicketRecord, created_by: 'other', organization: { id: 'org1' } })
        .mockResolvedValueOnce(updatedTicket);
      mockPrisma.ticket.update.mockResolvedValue(updatedTicket);
      mockNotificationsService.notifyTicketEvent.mockResolvedValue(undefined);

      const result = await service.update(ticketId, { title: 'New' }, orgSuperAdminUser as any);

      expect(result).toEqual(updatedTicket);
    });
  });

  describe('addNote', () => {
    const ticketId = 'ticket1';
    const noteDto = { content: 'A note', is_internal: false };
    const baseTicketRecord = { id: ticketId, created_by: '1', organization: { id: 'org1' } };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should throw BadRequestException when ticket not found', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(null);

      await expect(service.addNote(ticketId, noteDto, userfake as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when organization_admin adds note to someone elses ticket', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({ ...baseTicketRecord, created_by: 'other-user' });

      await expect(service.addNote(ticketId, noteDto, userfake as any)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when organization_super_admin adds note to ticket from other org', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        ...baseTicketRecord,
        created_by: 'other-user',
        organization: { id: 'other-org' },
      });

      await expect(service.addNote(ticketId, noteDto, orgSuperAdminUser as any)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when non-system-admin tries to create internal note', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(baseTicketRecord);

      await expect(
        service.addNote(ticketId, { content: 'internal', is_internal: true }, userfake as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create note using ticketNotes.create when available (non-creator notifies creator)', async () => {
      // Ticket created by 'other-creator'; note added by systemAdminUser whose id is 'admin1'
      mockPrisma.ticket.findUnique.mockResolvedValue({ ...baseTicketRecord, created_by: 'other-creator' });
      const mockNote = {
        id: 'note1',
        content: noteDto.content,
        is_internal: false,
        USER: { id: 'admin1', first_name: 'Admin', last_name: 'User', email: 'admin@test.com', role: 'system_admin' },
      };
      (mockPrisma as any).ticketNotes = { create: jest.fn().mockResolvedValue(mockNote) };
      mockNotificationsService.notifyTicketNoteAddedToCreator.mockResolvedValue(undefined);

      const result = await service.addNote(ticketId, noteDto, systemAdminUser as any);

      expect(result).toEqual(mockNote);
      expect(mockNotificationsService.notifyTicketNoteAddedToCreator).toHaveBeenCalledWith(
        ticketId,
        expect.objectContaining({ content: noteDto.content }),
      );
    });

    it('should notify assignee when creator adds a note', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(baseTicketRecord);
      const mockNote = {
        id: 'note1',
        content: noteDto.content,
        is_internal: false,
        USER: { id: '1', first_name: 'John', last_name: 'Doe', email: 'test@test.com', role: 'organization_admin' },
      };
      (mockPrisma as any).ticketNotes = { create: jest.fn().mockResolvedValue(mockNote) };
      mockNotificationsService.notifyTicketNoteAddedToAssignee.mockResolvedValue(undefined);

      await service.addNote(ticketId, noteDto, userfake as any);

      expect(mockNotificationsService.notifyTicketNoteAddedToAssignee).toHaveBeenCalledWith(
        ticketId,
        expect.objectContaining({ content: noteDto.content }),
      );
    });

    it('should allow system_admin to create internal note', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(baseTicketRecord);
      const mockNote = {
        id: 'note1',
        content: 'internal',
        is_internal: true,
        USER: { id: 'admin1', first_name: 'Admin', last_name: 'User', email: 'admin@test.com', role: 'system_admin' },
      };
      (mockPrisma as any).ticketNotes = { create: jest.fn().mockResolvedValue(mockNote) };

      const result = await service.addNote(ticketId, { content: 'internal', is_internal: true }, systemAdminUser as any);

      expect(result).toEqual(mockNote);
    });

    it('should swallow notification errors and still return note', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(baseTicketRecord);
      const mockNote = {
        id: 'note1', content: 'A note', is_internal: false,
        USER: { id: '1', first_name: 'J', last_name: 'D', email: 'e@e.com', role: 'org' },
      };
      (mockPrisma as any).ticketNotes = { create: jest.fn().mockResolvedValue(mockNote) };
      mockNotificationsService.notifyTicketNoteAddedToAssignee.mockRejectedValue(new Error('err'));

      const result = await service.addNote(ticketId, noteDto, userfake as any);

      expect(result).toEqual(mockNote);
    });

    it('should use $executeRawUnsafe fallback when ticketNotes model not available', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(baseTicketRecord);
      delete (mockPrisma as any).ticketNotes;
      mockPrisma.$executeRawUnsafe.mockResolvedValue(1);
      mockPrisma.$queryRawUnsafe.mockResolvedValue([{
        id: 'note1', content: 'A note', is_internal: false, ticket_id: ticketId,
        user_id: '1', first_name: 'John', last_name: 'Doe', email: 'test@test.com', role: 'organization_admin',
      }]);
      mockNotificationsService.notifyTicketNoteAddedToAssignee.mockResolvedValue(undefined);

      const result = await service.addNote(ticketId, noteDto, userfake as any) as any;

      expect(result).toBeDefined();
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalled();
    });
  });

  describe('listNotes', () => {
    const ticketId = 'ticket1';
    const baseTicketRecord = { id: ticketId, created_by: '1', organization: { id: 'org1' } };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should throw BadRequestException when ticket not found', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(null);

      await expect(service.listNotes(ticketId, userfake as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when organization_admin lists notes for others ticket', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({ ...baseTicketRecord, created_by: 'other' });

      await expect(service.listNotes(ticketId, userfake as any)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when organization_super_admin accesses other orgs ticket notes', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        ...baseTicketRecord,
        created_by: 'other',
        organization: { id: 'other-org' },
      });

      await expect(service.listNotes(ticketId, orgSuperAdminUser as any)).rejects.toThrow(ForbiddenException);
    });

    it('should return notes using ticketNotes.findMany for system admin (can see internal)', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(baseTicketRecord);
      const mockNotes = [
        { id: 'n1', content: 'public', is_internal: false, USER: { id: '1', first_name: 'John', last_name: 'Doe', email: 'e@e.com', role: 'system_admin' } },
        { id: 'n2', content: 'private', is_internal: true, USER: { id: '1', first_name: 'John', last_name: 'Doe', email: 'e@e.com', role: 'system_admin' } },
      ];
      (mockPrisma as any).ticketNotes = { findMany: jest.fn().mockResolvedValue(mockNotes) };

      const result = await service.listNotes(ticketId, systemAdminUser as any) as any[];

      expect(result).toHaveLength(2);
      expect(result[0].author_name).toBe('John Doe');
      expect(result[0].author_role).toBe('system_admin');
    });

    it('should filter internal notes for non-system-admin using ticketNotes.findMany', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(baseTicketRecord);
      const mockNotes = [
        { id: 'n1', content: 'public', is_internal: false, USER: { id: '1', first_name: 'Jane', last_name: 'Doe', email: 'j@j.com', role: 'org' } },
      ];
      (mockPrisma as any).ticketNotes = { findMany: jest.fn().mockResolvedValue(mockNotes) };

      const result = await service.listNotes(ticketId, userfake as any) as any[];

      expect(result).toHaveLength(1);
      const findManyCall = (mockPrisma as any).ticketNotes.findMany.mock.calls[0][0];
      expect(findManyCall.where).toEqual(expect.objectContaining({ is_internal: false }));
    });

    it('should use $queryRawUnsafe fallback when ticketNotes model not available', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(baseTicketRecord);
      delete (mockPrisma as any).ticketNotes;
      mockPrisma.$queryRawUnsafe.mockResolvedValue([{
        id: 'n1', content: 'public', is_internal: false, ticket_id: ticketId,
        user_id: '1', first_name: 'John', last_name: 'Doe', email: 'test@test.com', role: 'organization_admin',
      }]);

      const result = await service.listNotes(ticketId, userfake as any) as any[];

      expect(result).toHaveLength(1);
      expect(result[0].author_name).toBe('John Doe');
    });
  });

  describe('create — additional branches', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should build data with candidate_id when creating Interview Request ticket', async () => {
      const candidateId = 'cand1';
      mockPrisma.candidate.findUnique.mockResolvedValue({ id: candidateId });
      mockPrisma.uSER.findUnique
        .mockResolvedValueOnce({ id: 'admin1' })
        .mockResolvedValueOnce({ id: 'user1' });
      const createdTicket = { id: 'new-ticket' };
      const fullTicket = { id: 'new-ticket', type: 'interview', candidate: { id: candidateId } };
      mockPrisma.ticket.create.mockResolvedValue(createdTicket);
      mockPrisma.ticket.findUnique.mockResolvedValue(fullTicket);
      mockNotificationsService.notifyTicketEvent.mockResolvedValue(undefined);

      const result = await service.create(
        { type: 'Interview Request', candidate_id: candidateId, title: 'T', description: 'D', priority: 'HIGH' as Priority, client_id: 'org1', assigned_user_id: ['user1'] } as any,
        systemAdminUser as any,
      );

      expect(result).toEqual(fullTicket);
      expect(mockPrisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ candidate: { connect: { id: candidateId } } }),
        }),
      );
    });

    it('should build data with staff_id and hireRequest_id for Termination ticket by system admin', async () => {
      const staffId = 'staff1';
      const hrId = 'hr1';
      mockPrisma.staff.findUnique.mockResolvedValue({ id: staffId, hireRequest: { org_id: 'org1' } });
      mockPrisma.hireRequest.findUnique.mockResolvedValue({ id: hrId });
      mockPrisma.uSER.findUnique
        .mockResolvedValueOnce({ id: 'admin1' })
        .mockResolvedValueOnce({ id: 'user1' });
      const createdTicket = { id: 'new-ticket2' };
      const fullTicket = { id: 'new-ticket2', type: 'termination' };
      mockPrisma.ticket.create.mockResolvedValue(createdTicket);
      mockPrisma.ticket.findUnique.mockResolvedValue(fullTicket);
      mockNotificationsService.notifyTicketEvent.mockResolvedValue(undefined);

      const result = await service.create(
        { type: 'Termination', staff_id: staffId, hireRequest_id: hrId, title: 'T', description: 'D', priority: 'HIGH' as Priority, client_id: 'org1', assigned_user_id: ['user1'] } as any,
        systemAdminUser as any,
      );

      expect(result).toEqual(fullTicket);
      expect(mockPrisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            staff: { connect: { id: staffId } },
            hireRequest: { connect: { id: hrId } },
          }),
        }),
      );
    });

    it('should throw when findOne returns null after ticket.create', async () => {
      mockPrisma.uSER.findUnique
        .mockResolvedValueOnce({ id: 'admin1' })
        .mockResolvedValueOnce({ id: 'user1' });
      mockPrisma.ticket.create.mockResolvedValue({ id: 'new' });
      // findOne calls ticket.findUnique — return null to trigger !ticketFull path
      mockPrisma.ticket.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          { type: 'Support', title: 'T', description: 'D', priority: 'HIGH' as Priority, client_id: 'org1', assigned_user_id: ['user1'] } as any,
          systemAdminUser as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should use assigned_user_id directly when system admin uses non-Support ticket type', async () => {
      // system admin (non-org role) + non-Support type => goes to the else branch (lines 228-229)
      const staffId = 'staff1';
      mockPrisma.staff.findUnique.mockResolvedValue({ id: staffId, hireRequest: { org_id: 'org1' } });
      mockPrisma.uSER.findUnique
        .mockResolvedValueOnce({ id: 'admin1' })
        .mockResolvedValueOnce({ id: 'user1' });
      mockPrisma.ticket.create.mockResolvedValue({ id: 'new3' });
      mockPrisma.ticket.findUnique.mockResolvedValue({ id: 'new3', type: 'termination' });
      mockNotificationsService.notifyTicketEvent.mockResolvedValue(undefined);

      const result = await service.create(
        { type: 'Termination', staff_id: staffId, title: 'T', description: 'D', priority: 'HIGH' as Priority, client_id: 'org1', assigned_user_id: ['user1'] } as any,
        systemAdminUser as any,
      );

      expect(result).toBeDefined();
    });
  });

  describe('isSystemAdmin (via create context)', () => {
    it('should recognise system_admin role as system admin', async () => {
      mockPrisma.uSER.findUnique.mockResolvedValue({ id: 'admin1' });
      mockPrisma.ticket.create.mockResolvedValue({ id: 'new' });
      mockPrisma.ticket.findUnique.mockResolvedValue({ id: 'new', title: 'T' });
      mockNotificationsService.notifyTicketEvent.mockResolvedValue(undefined);

      const result = await service.create(
        { type: 'Support', title: 'T', description: 'D', priority: 'HIGH' as Priority, client_id: 'org1' } as any,
        systemAdminUser as any,
      );

      expect(result).toBeDefined();
    });
  });

});
