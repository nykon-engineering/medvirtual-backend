import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prismaService: PrismaService;
  let mailService: MailService;

  const mockPrismaService = {
    hireRequest: {
      findUnique: jest.fn(),
    },
    ticket: {
      findUnique: jest.fn(),
    },
  };

  const mockMailService = {
    sendMail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    prismaService = module.get<PrismaService>(PrismaService);
    mailService = module.get<MailService>(MailService);

    // Set up environment variables for tests
    process.env.FRONTEND_URL = 'https://test.example.com';
    process.env.RESEND_API_KEY = 'test-api-key';

    jest.clearAllMocks();
  });

  describe('buildEmail', () => {
    it('should build email with proper HTML structure', () => {
      const htmlInner = '<h1>Test Content</h1>';
      const result = (service as any).buildEmail(htmlInner);
      
      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('<html><body>');
      expect(result).toContain('<div style="max-width:600px;margin:0 auto;background:#ffffff;">');
      expect(result).toContain(htmlInner);
      expect(result).toContain('</div></body></html>');
    });
  });

  describe('notifyHireRequestPlacementCompleted', () => {
    const mockHireRequest = {
      id: 'hr1',
      title: 'Senior Developer',
      description: 'Looking for a senior developer',
      status: 'placement_completed',
      priority: 'high',
      specialization: 'Frontend',
      location: 'Remote',
      salary_range_from: 5000,
      salary_range_to: 8000,
      expected_start_date: new Date('2024-02-01'),
      assigned_user: {
        email: 'assignee@example.com',
        first_name: 'John',
        last_name: 'Doe',
      },
      organization: {
        name: 'Test Company',
      },
    };

    it('should send notification email successfully', async () => {
      mockPrismaService.hireRequest.findUnique.mockResolvedValue(mockHireRequest);
      mockMailService.sendMail.mockResolvedValue(true);

      const result = await service.notifyHireRequestPlacementCompleted('hr1');

      expect(result).toBe(true);
      expect(mockPrismaService.hireRequest.findUnique).toHaveBeenCalledWith({
        where: { id: 'hr1' },
        select: expect.any(Object),
      });
      expect(mockMailService.sendMail).toHaveBeenCalledWith({
        from: 'MedVirtual <noreply@medvirtual.ai>',
        to: ['assignee@example.com'],
        subject: 'Placement completed: Senior Developer',
        html: expect.stringContaining('Placement Completed'),
      });
    });

    it('should throw NotFoundException when hire request not found', async () => {
      mockPrismaService.hireRequest.findUnique.mockResolvedValue(null);

      await expect(service.notifyHireRequestPlacementCompleted('hr1'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when no assignee email', async () => {
      const hireRequestWithoutEmail = { ...mockHireRequest, assigned_user: { email: null } };
      mockPrismaService.hireRequest.findUnique.mockResolvedValue(hireRequestWithoutEmail);

      await expect(service.notifyHireRequestPlacementCompleted('hr1'))
        .rejects.toThrow(BadRequestException);
    });

    it('should handle missing salary range and start date', async () => {
      const hireRequestMinimal = {
        ...mockHireRequest,
        salary_range_from: null,
        salary_range_to: null,
        expected_start_date: null,
      };
      mockPrismaService.hireRequest.findUnique.mockResolvedValue(hireRequestMinimal);
      mockMailService.sendMail.mockResolvedValue(true);

      await service.notifyHireRequestPlacementCompleted('hr1');

      expect(mockMailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('Not specified'),
        })
      );
    });
  });

  describe('notifyHireRequestClientChange', () => {
    const mockHireRequest = {
      id: 'hr1',
      title: 'Senior Developer',
      description: 'Looking for a senior developer',
      priority: 'high',
      specialization: 'Frontend',
      location: 'Remote',
      assigned_user: { email: 'assignee@example.com' },
      organization: { name: 'Test Company' },
    };

    it('should send notification for edited hire request', async () => {
      mockPrismaService.hireRequest.findUnique.mockResolvedValue(mockHireRequest);
      mockMailService.sendMail.mockResolvedValue(true);

      const result = await service.notifyHireRequestClientChange('hr1', 'edited');

      expect(result).toBe(true);
      expect(mockMailService.sendMail).toHaveBeenCalledWith({
        from: 'MedVirtual <noreply@medvirtual.ai>',
        to: ['assignee@example.com'],
        subject: 'Hire Request edited: Senior Developer',
        html: expect.stringContaining('Hire Request EDITED'),
      });
    });

    it('should send notification for canceled hire request', async () => {
      mockPrismaService.hireRequest.findUnique.mockResolvedValue(mockHireRequest);
      mockMailService.sendMail.mockResolvedValue(true);

      const result = await service.notifyHireRequestClientChange('hr1', 'canceled');

      expect(result).toBe(true);
      expect(mockMailService.sendMail).toHaveBeenCalledWith({
        from: 'MedVirtual <noreply@medvirtual.ai>',
        to: ['assignee@example.com'],
        subject: 'Hire Request canceled: Senior Developer',
        html: expect.stringContaining('Hire Request CANCELED'),
      });
    });

    it('should throw NotFoundException when hire request not found', async () => {
      mockPrismaService.hireRequest.findUnique.mockResolvedValue(null);

      await expect(service.notifyHireRequestClientChange('hr1', 'edited'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when no assignee email', async () => {
      const hireRequestWithoutEmail = { ...mockHireRequest, assigned_user: { email: null } };
      mockPrismaService.hireRequest.findUnique.mockResolvedValue(hireRequestWithoutEmail);

      await expect(service.notifyHireRequestClientChange('hr1', 'edited'))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('notifyHireRequestCreated', () => {
    const mockHireRequest = {
      id: 'hr1',
      title: 'Senior Developer',
      description: 'Looking for a senior developer',
      status: 'new',
      priority: 'high',
      specialization: 'Frontend',
      location: 'Remote',
      salary_range_from: 5000,
      salary_range_to: 8000,
      expected_start_date: new Date('2024-02-01'),
      availability: 'full-time',
      contract_length: '6 months',
      assigned_user: {
        email: 'assignee@example.com',
        first_name: 'John',
        last_name: 'Doe',
      },
      organization: { name: 'Test Company' },
    };

    it('should send notification email successfully', async () => {
      mockPrismaService.hireRequest.findUnique.mockResolvedValue(mockHireRequest);
      mockMailService.sendMail.mockResolvedValue(true);

      const result = await service.notifyHireRequestCreated('hr1');

      expect(result).toBe(true);
      expect(mockPrismaService.hireRequest.findUnique).toHaveBeenCalledWith({
        where: { id: 'hr1' },
        select: expect.any(Object),
      });
      expect(mockMailService.sendMail).toHaveBeenCalledWith({
        from: 'MedVirtual <noreply@medvirtual.ai>',
        to: ['assignee@example.com'],
        subject: 'New Hire Request Assigned: Senior Developer',
        html: expect.stringContaining('New Hire Request Assigned'),
      });
    });

    it('should throw NotFoundException when hire request not found', async () => {
      mockPrismaService.hireRequest.findUnique.mockResolvedValue(null);

      await expect(service.notifyHireRequestCreated('hr1'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when no assignee email', async () => {
      const hireRequestWithoutEmail = { ...mockHireRequest, assigned_user: { email: null } };
      mockPrismaService.hireRequest.findUnique.mockResolvedValue(hireRequestWithoutEmail);

      await expect(service.notifyHireRequestCreated('hr1'))
        .rejects.toThrow(BadRequestException);
    });

    it('should handle missing optional fields', async () => {
      const hireRequestMinimal = {
        ...mockHireRequest,
        description: null,
        location: null,
        contract_length: null,
        salary_range_from: null,
        salary_range_to: null,
        expected_start_date: null,
      };
      mockPrismaService.hireRequest.findUnique.mockResolvedValue(hireRequestMinimal);
      mockMailService.sendMail.mockResolvedValue(true);

      await service.notifyHireRequestCreated('hr1');

      expect(mockMailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('No description provided'),
        })
      );
    });
  });

  describe('notifyTicketEvent', () => {
    const mockTicket = {
      id: 'ticket1',
      title: 'Bug Report',
      description: 'Application crashes on login',
      status: 'new',
      priority: 'high',
      type: 'bug',
      createdAt: new Date('2024-01-15'),
      user: { email: 'assignee@example.com' },
      organization: { name: 'Test Company' },
    };

    it('should send notification for created ticket', async () => {
      mockPrismaService.ticket.findUnique.mockResolvedValue(mockTicket);
      mockMailService.sendMail.mockResolvedValue(true);

      const result = await service.notifyTicketEvent('ticket1', 'created');

      expect(result).toBe(true);
      expect(mockPrismaService.ticket.findUnique).toHaveBeenCalledWith({
        where: { id: 'ticket1' },
        select: expect.any(Object),
      });
      expect(mockMailService.sendMail).toHaveBeenCalledWith({
        from: 'MedVirtual <noreply@medvirtual.ai>',
        to: ['assignee@example.com'],
        subject: 'Ticket created: Bug Report',
        html: expect.stringContaining('Ticket CREATED'),
      });
    });

    it('should send notification for assigned ticket', async () => {
      mockPrismaService.ticket.findUnique.mockResolvedValue(mockTicket);
      mockMailService.sendMail.mockResolvedValue(true);

      const result = await service.notifyTicketEvent('ticket1', 'assigned');

      expect(result).toBe(true);
      expect(mockMailService.sendMail).toHaveBeenCalledWith({
        from: 'MedVirtual <noreply@medvirtual.ai>',
        to: ['assignee@example.com'],
        subject: 'Ticket assigned: Bug Report',
        html: expect.stringContaining('Ticket ASSIGNED'),
      });
    });

    it('should send notification for canceled ticket', async () => {
      mockPrismaService.ticket.findUnique.mockResolvedValue(mockTicket);
      mockMailService.sendMail.mockResolvedValue(true);

      const result = await service.notifyTicketEvent('ticket1', 'canceled');

      expect(result).toBe(true);
      expect(mockMailService.sendMail).toHaveBeenCalledWith({
        from: 'MedVirtual <noreply@medvirtual.ai>',
        to: ['assignee@example.com'],
        subject: 'Ticket canceled: Bug Report',
        html: expect.stringContaining('Ticket CANCELED'),
      });
    });

    it('should throw NotFoundException when ticket not found', async () => {
      mockPrismaService.ticket.findUnique.mockResolvedValue(null);

      await expect(service.notifyTicketEvent('ticket1', 'created'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when no assignee email', async () => {
      const ticketWithoutEmail = { ...mockTicket, user: { email: null } };
      mockPrismaService.ticket.findUnique.mockResolvedValue(ticketWithoutEmail);

      await expect(service.notifyTicketEvent('ticket1', 'created'))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when user is null', async () => {
      const ticketWithoutUser = { ...mockTicket, user: null };
      mockPrismaService.ticket.findUnique.mockResolvedValue(ticketWithoutUser);

      await expect(service.notifyTicketEvent('ticket1', 'created'))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('email content validation', () => {
    it('should include proper detail URLs in hire request emails', async () => {
      const mockHireRequest = {
        id: 'hr1',
        title: 'Test Job',
        description: 'Test description',
        status: 'new',
        priority: 'high',
        specialization: 'Frontend',
        location: 'Remote',
        salary_range_from: 5000,
        salary_range_to: 8000,
        expected_start_date: new Date('2024-02-01'),
        availability: 'full-time',
        contract_length: '6 months',
        assigned_user: { email: 'test@example.com', first_name: 'John', last_name: 'Doe' },
        organization: { name: 'Test Company' },
      };

      mockPrismaService.hireRequest.findUnique.mockResolvedValue(mockHireRequest);
      mockMailService.sendMail.mockResolvedValue(true);

      await service.notifyHireRequestCreated('hr1');

      expect(mockMailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('https://test.example.com/hire-requests?request=hr1'),
        })
      );
    });

    it('should include proper detail URLs in ticket emails', async () => {
      const mockTicket = {
        id: 'ticket1',
        title: 'Test Ticket',
        description: 'Test description',
        status: 'new',
        priority: 'high',
        type: 'bug',
        createdAt: new Date('2024-01-15'),
        user: { email: 'test@example.com' },
        organization: { name: 'Test Company' },
      };

      mockPrismaService.ticket.findUnique.mockResolvedValue(mockTicket);
      mockMailService.sendMail.mockResolvedValue(true);

      await service.notifyTicketEvent('ticket1', 'created');

      expect(mockMailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('https://test.example.com/tickets?ticket=ticket1'),
        })
      );
    });
  });

  describe('error handling', () => {
    it('should propagate mail service errors', async () => {
      const mockHireRequest = {
        id: 'hr1',
        title: 'Test Job',
        description: 'Test description',
        status: 'new',
        priority: 'high',
        specialization: 'Frontend',
        location: 'Remote',
        salary_range_from: 5000,
        salary_range_to: 8000,
        expected_start_date: new Date('2024-02-01'),
        availability: 'full-time',
        contract_length: '6 months',
        assigned_user: { email: 'test@example.com', first_name: 'John', last_name: 'Doe' },
        organization: { name: 'Test Company' },
      };

      mockPrismaService.hireRequest.findUnique.mockResolvedValue(mockHireRequest);
      mockMailService.sendMail.mockRejectedValue(new Error('Mail service error'));

      await expect(service.notifyHireRequestCreated('hr1'))
        .rejects.toThrow('Mail service error');
    });

    it('should propagate prisma service errors', async () => {
      mockPrismaService.hireRequest.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(service.notifyHireRequestCreated('hr1'))
        .rejects.toThrow('Database error');
    });
  });
});
