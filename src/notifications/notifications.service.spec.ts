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
    uSER: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
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
      expect(result).toContain('<html lang="en">');
      expect(result).toContain('<div class="email-wrapper">');
      expect(result).toContain('<div class="container">');
      expect(result).toContain(htmlInner);
      expect(result).toContain('</body>');
      expect(result).toContain('</html>');
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
      panels: [
        {
          id: 'panel1',
          panelCandidates: [
            {
              candidate: {
                id: 'candidate1',
                first_name: 'Jane',
                last_name: 'Smith',
                name: 'Jane Smith',
              },
            },
          ],
        },
      ],
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
      expect(mockMailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'MedVirtual <noreply@medvirtual.ai>',
          to: ['assignee@example.com'],
          subject: 'Placement completed: Senior Developer',
          html: expect.stringContaining('Placement Completed'),
        })
      );
      expect(mockMailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringMatching(/Selected Candidate:.*Jane Smith/),
        })
      );
    });

    it('should throw NotFoundException when hire request not found', async () => {
      mockPrismaService.hireRequest.findUnique.mockResolvedValue(null);

      await expect(service.notifyHireRequestPlacementCompleted('hr1'))
        .rejects.toThrow(NotFoundException);
    });

    it('should handle missing winner candidate gracefully', async () => {
      const mockHireRequestWithoutWinner = {
        ...mockHireRequest,
        panels: [
          {
            id: 'panel1',
            panelCandidates: [],
          },
        ],
      };
      
      mockPrismaService.hireRequest.findUnique.mockResolvedValue(mockHireRequestWithoutWinner);
      mockMailService.sendMail.mockResolvedValue(true);

      const result = await service.notifyHireRequestPlacementCompleted('hr1');

      expect(result).toBe(true);
      expect(mockMailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringMatching(/Selected Candidate:.*Not specified/),
        })
      );
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
      created_by: 'creator1',
      user: { id: 'assignee1', email: 'assignee@example.com', role: 'system_admin' },
      organization: { name: 'Test Company' },
      staff: null,
      candidate: null,
    };

    it('should send notification for created ticket', async () => {
      // Mock creator lookup
      mockPrismaService.uSER.findUnique.mockResolvedValue({ id: 'creator1', email: 'creator@example.com', role: 'system_admin' });
      mockMailService.sendMail.mockResolvedValue(true);

      const result = await service.notifyTicketEvent(mockTicket, 'created');

      expect(result).toBe(true);
      // For system admins, subject format is different (e.g., "bug Ticket Created for Test Company")
      expect(mockMailService.sendMail).toHaveBeenCalledTimes(2); // Once for creator, once for assignee
      expect(mockMailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'MedVirtual <noreply@medvirtual.ai>',
          to: expect.arrayContaining([expect.any(String)]),
          subject: expect.stringMatching(/Ticket Created|Bug Report/),
          html: expect.stringContaining('Bug Report'),
        })
      );
    });

    it('should not send notification when creator and assignee are the same', async () => {
      const ticketSameUser = {
        ...mockTicket,
        created_by: 'assignee1',
        user: { id: 'assignee1', email: 'assignee@example.com', role: 'system_admin' },
      };
      mockPrismaService.ticket.findUnique.mockResolvedValue({ created_by: 'assignee1', user_id: 'assignee1' });

      const result = await service.notifyTicketEvent(ticketSameUser, 'created');

      expect(result).toBe(false);
      expect(mockMailService.sendMail).not.toHaveBeenCalled();
    });

    it('should send notification for assigned ticket', async () => {
      // Mock creator lookup
      mockPrismaService.uSER.findUnique.mockResolvedValue({ id: 'creator1', email: 'creator@example.com', role: 'system_admin' });
      mockMailService.sendMail.mockResolvedValue(true);

      const result = await service.notifyTicketEvent(mockTicket, 'assigned');

      expect(result).toBe(true);
      expect(mockMailService.sendMail).toHaveBeenCalledWith({
        from: 'MedVirtual <noreply@medvirtual.ai>',
        to: expect.arrayContaining([expect.any(String)]),
        subject: expect.stringContaining('Bug Report'),
        html: expect.stringContaining('Ticket ASSIGNED'),
      });
    });

    it('should send notification for closed ticket', async () => {
      // Mock creator lookup
      mockPrismaService.uSER.findUnique.mockResolvedValue({ id: 'creator1', email: 'creator@example.com', role: 'system_admin' });
      mockMailService.sendMail.mockResolvedValue(true);

      const result = await service.notifyTicketEvent(mockTicket, 'closed');

      expect(result).toBe(true);
      expect(mockMailService.sendMail).toHaveBeenCalledWith({
        from: 'MedVirtual <noreply@medvirtual.ai>',
        to: expect.arrayContaining([expect.any(String)]),
        subject: expect.stringContaining('Bug Report'),
        html: expect.stringContaining('Ticket CLOSED'),
      });
    });

    it('should throw NotFoundException when ticket not found', async () => {
      await expect(service.notifyTicketEvent(null, 'created'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when no assignee email and no creator', async () => {
      const ticketWithoutEmail = { ...mockTicket, user: { email: null }, created_by: null };
      
      // Mock the ticket.findUnique call that happens when created_by is null but ticket.id exists
      mockPrismaService.ticket.findUnique.mockResolvedValue({ created_by: null, user_id: null });
      // Mock uSER.findUnique to return null (no creator email found)
      mockPrismaService.uSER.findUnique.mockResolvedValue(null);

      await expect(service.notifyTicketEvent(ticketWithoutEmail, 'created'))
        .rejects.toThrow(BadRequestException);
    });

    it('should not throw when user is null but creator exists', async () => {
      const ticketWithoutUser = { ...mockTicket, user: null, created_by: 'creator1' };
      mockPrismaService.uSER.findUnique.mockResolvedValue({ id: 'creator1', email: 'creator@example.com', role: 'system_admin' });
      mockMailService.sendMail.mockResolvedValue(true);

      const result = await service.notifyTicketEvent(ticketWithoutUser, 'created');
      expect(result).toBe(true);
    });

    it('should include staff member details when present', async () => {
      const ticketWithStaff = {
        ...mockTicket,
        created_by: 'creator1',
        user: { id: 'assignee1', email: 'assignee@example.com', role: 'system_admin' },
        staff: {
          id: 'staff1',
          candidate: {
            id: 'candidate1',
            name: 'John Doe',
            email: 'john.doe@example.com',
          },
        },
      };
      // Mock creator lookup
      mockPrismaService.uSER.findUnique.mockResolvedValue({ id: 'creator1', email: 'creator@example.com', role: 'system_admin' });
      mockMailService.sendMail.mockResolvedValue(true);

      await service.notifyTicketEvent(ticketWithStaff, 'created');

      expect(mockMailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringMatching(/Staff Member:.*John Doe/),
        })
      );
      // Staff email is no longer included in the email
      expect(mockMailService.sendMail).not.toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringMatching(/Staff Email:/),
        })
      );
    });

    it('should include candidate details when present', async () => {
      const ticketWithCandidate = {
        ...mockTicket,
        created_by: 'creator1',
        user: { id: 'assignee1', email: 'assignee@example.com', role: 'system_admin' },
        candidate: {
          id: 'candidate1',
          name: 'Jane Smith',
          email: 'jane.smith@example.com',
        },
      };
      // Mock creator lookup
      mockPrismaService.uSER.findUnique.mockResolvedValue({ id: 'creator1', email: 'creator@example.com', role: 'system_admin' });
      mockMailService.sendMail.mockResolvedValue(true);

      await service.notifyTicketEvent(ticketWithCandidate, 'created');

      expect(mockMailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringMatching(/Candidate:.*Jane Smith/),
        })
      );
      // Candidate email is no longer included in the email
      expect(mockMailService.sendMail).not.toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringMatching(/Candidate Email:/),
        })
      );
    });

    it('should include both staff and candidate details when both are present', async () => {
      const ticketWithBoth = {
        ...mockTicket,
        created_by: 'creator1',
        user: { id: 'assignee1', email: 'assignee@example.com', role: 'system_admin' },
        staff: {
          id: 'staff1',
          candidate: {
            id: 'candidate1',
            name: 'John Doe',
            email: 'john.doe@example.com',
          },
        },
        candidate: {
          id: 'candidate2',
          name: 'Jane Smith',
          email: 'jane.smith@example.com',
        },
      };
      // Mock creator lookup
      mockPrismaService.uSER.findUnique.mockResolvedValue({ id: 'creator1', email: 'creator@example.com', role: 'system_admin' });
      mockMailService.sendMail.mockResolvedValue(true);

      await service.notifyTicketEvent(ticketWithBoth, 'created');

      expect(mockMailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringMatching(/Staff Member:.*John Doe/),
        })
      );
      expect(mockMailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringMatching(/Candidate:.*Jane Smith/),
        })
      );
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
        created_by: 'creator1',
        user: { id: 'assignee1', email: 'test@example.com', role: 'system_admin' },
        organization: { name: 'Test Company' },
        staff: null,
        candidate: null,
      };

      // Mock creator lookup
      mockPrismaService.uSER.findUnique.mockResolvedValue({ id: 'creator1', email: 'creator@example.com', role: 'system_admin' });
      mockMailService.sendMail.mockResolvedValue(true);

      await service.notifyTicketEvent(mockTicket, 'created');

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
