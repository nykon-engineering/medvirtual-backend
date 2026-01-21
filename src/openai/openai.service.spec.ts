import { Test, TestingModule } from '@nestjs/testing';
import { OpenaiService } from './openai.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';

// Mock OpenAI
const mockChatCreate = jest.fn();
jest.mock('openai', () => {
  return class OpenAI {
    chat = {
      completions: {
        create: mockChatCreate,
      },
    };
  };
});

// Mock fs
jest.mock('fs');

const mockMailService = {
  sendMail: jest.fn(),
};

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  mail_Settings: {
    findFirst: jest.fn(),
    create: jest.fn(),
  }
};

describe('OpenaiService', () => {
  let service: OpenaiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenaiService,
        { provide: MailService, useValue: mockMailService },
        { provide: PrismaService, useValue: mockPrismaService }
      ],
    }).compile();

    service = module.get<OpenaiService>(OpenaiService);
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractDataFromResumeImages', () => {
    const mockImagePaths = ['/path/to/image1.png'];
    const mockExtractedData = {
      bio: 'Test Bio',
      experience: [],
      education: [],
      skills: []
    };

    beforeEach(() => {
      (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from('mock-image-data'));
    });

    it('should successfully extract data from images', async () => {
      mockChatCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(mockExtractedData)
          }
        }]
      });

      const result = await service.extractDataFromResumeImages(mockImagePaths);

      expect(result).toEqual(mockExtractedData);
      expect(fs.readFileSync).toHaveBeenCalledWith(mockImagePaths[0]);
      expect(mockChatCreate).toHaveBeenCalled();
    });

    it('should handle insufficient quota error and send email', async () => {
      const error = { type: 'insufficient_quota' };
      mockChatCreate.mockRejectedValue(error);

      // Mock no email sent today
      mockPrismaService.mail_Settings.findFirst.mockResolvedValue(null);
      mockMailService.sendMail.mockResolvedValue(true);

      await expect(service.extractDataFromResumeImages(mockImagePaths))
        .rejects
        .toThrow('You dont have credits. Check your plan/billing.');

      expect(mockPrismaService.mail_Settings.findFirst).toHaveBeenCalled();
      expect(mockMailService.sendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'shayan@regenta.ai',
        subject: 'Insufficient Quota from OpenAI'
      }));
      expect(mockPrismaService.mail_Settings.create).toHaveBeenCalledWith({
        data: { title: 'insufficient_quota' }
      });
    });

    it('should not send email if already sent today for insufficient quota', async () => {
      const error = { type: 'insufficient_quota' };
      mockChatCreate.mockRejectedValue(error);

      // Mock email already sent
      mockPrismaService.mail_Settings.findFirst.mockResolvedValue({ id: '1' });

      await expect(service.extractDataFromResumeImages(mockImagePaths))
        .rejects
        .toThrow('You dont have credits. Check your plan/billing.');

      expect(mockPrismaService.mail_Settings.findFirst).toHaveBeenCalled();
      expect(mockMailService.sendMail).not.toHaveBeenCalled();
      expect(mockPrismaService.mail_Settings.create).not.toHaveBeenCalled();
    });

    it('should handle rate limit error', async () => {
      const error = { type: 'rate_limit_error' };
      mockChatCreate.mockRejectedValue(error);

      await expect(service.extractDataFromResumeImages(mockImagePaths))
        .rejects
        .toThrow('Rate limit exceeded. Please try again later.');
    });

    it('should handle unexpected errors', async () => {
      mockChatCreate.mockRejectedValue(new Error('Unexpected error'));

      await expect(service.extractDataFromResumeImages(mockImagePaths))
        .rejects
        .toThrow('Failed to extract data from resume images');
    });
  });
});
