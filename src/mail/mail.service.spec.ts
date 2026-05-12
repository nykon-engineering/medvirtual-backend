import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service';

jest.mock('resend');

describe('MailService', () => {
  let service: MailService;
  let mockEmailsSend: jest.Mock;

  beforeEach(async () => {
    mockEmailsSend = jest.fn();
    const { Resend } = require('resend');
    (Resend as jest.Mock).mockImplementation(() => ({ emails: { send: mockEmailsSend } }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [MailService],
    }).compile();

    service = module.get<MailService>(MailService);
    process.env.RESEND_API_KEY = 'test-resend-key';
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendMail', () => {
    const validOptions = {
      from: 'noreply@medvirtual.ai',
      to: 'user@test.com',
      subject: 'Test Subject',
      html: '<p>Hello</p>',
    };

    it('should throw BadRequestException if RESEND_API_KEY is not set', async () => {
      delete process.env.RESEND_API_KEY;
      await expect(service.sendMail(validOptions)).rejects.toThrow(
        'RESEND_API_KEY is not set in environment variables',
      );
    });

    it('should throw BadRequestException if options are missing required fields', async () => {
      const invalidOptions = { to: 'user@test.com', subject: 'Test', html: '<p>hi</p>' };
      await expect(service.sendMail(invalidOptions)).rejects.toThrow('Invalid email options provided');
    });

    it('should throw BadRequestException if Resend returns no data', async () => {
      mockEmailsSend.mockResolvedValueOnce({ data: null, error: { message: 'Resend API error' } });
      await expect(service.sendMail(validOptions)).rejects.toThrow('Failed to send email');
    });

    it('should throw BadRequestException if Resend throws an error', async () => {
      mockEmailsSend.mockRejectedValueOnce(new Error('Network error'));
      await expect(service.sendMail(validOptions)).rejects.toThrow(BadRequestException);
    });

    it('should return true when email is sent successfully', async () => {
      mockEmailsSend.mockResolvedValueOnce({ data: { id: 'email-123' }, error: null });
      const result = await service.sendMail(validOptions);
      expect(result).toBe(true);
      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({ from: validOptions.from, to: validOptions.to }),
      );
    });

    it('should use default tags when none are provided', async () => {
      mockEmailsSend.mockResolvedValueOnce({ data: { id: 'email-123' } });
      await service.sendMail(validOptions);
      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: [
            { name: 'type', value: 'general' },
            { name: 'source', value: 'medvirtual' },
          ],
        }),
      );
    });

    it('should use custom tags when provided', async () => {
      const customTags = [{ name: 'env', value: 'test' }];
      mockEmailsSend.mockResolvedValueOnce({ data: { id: 'email-124' } });
      await service.sendMail({ ...validOptions, tags: customTags });
      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({ tags: customTags }),
      );
    });
  });
});
