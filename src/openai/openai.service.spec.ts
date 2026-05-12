import { Test, TestingModule } from '@nestjs/testing';
import { OpenaiService } from './openai.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';

// Mock OpenAI
const mockChatCreate = jest.fn();
const mockImagesEdit = jest.fn();

jest.mock('openai', () => {
  const MockOpenAI = class OpenAI {
    chat = { completions: { create: mockChatCreate } };
    images = { edit: mockImagesEdit };
  };
  return {
    default: MockOpenAI,
    toFile: jest.fn().mockResolvedValue({}),
    __esModule: true,
  };
});

// Mock fs — spread actual module so Prisma can still call existsSync etc.
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn(),
  createReadStream: jest.fn().mockReturnValue({}),
  writeFileSync: jest.fn(),
}));

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

      expect(result).toEqual({ data: mockExtractedData, cost: 0 });
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

  describe('organizeText', () => {
    const mockText = 'Resume plain text content';
    const mockCandidate = { name: 'John Doe', specialization: 'Medical Assistant' };

    it('should throw BadRequestException if OPENAI_API_KEY is not set', async () => {
      delete process.env.OPENAI_API_KEY;
      await expect(service.organizeText(mockText, mockCandidate)).rejects.toThrow(
        'OPENAI_API_KEY is not defined in environment variables',
      );
    });

    it('should return organized text when OpenAI responds with valid JSON', async () => {
      const mockData = { bio: 'Professional bio', experience: [], education: [] };
      mockChatCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(mockData) } }],
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      });

      const result = await service.organizeText(mockText, mockCandidate);
      const parsed = JSON.parse(result);

      expect(parsed.bio).toBe('Professional bio');
      expect(parsed.cost).toBeDefined();
    });

    it('should throw if OpenAI returns empty choices', async () => {
      mockChatCreate.mockResolvedValueOnce({ choices: [] });
      await expect(service.organizeText(mockText, mockCandidate)).rejects.toThrow(BadRequestException);
    });

    it('should throw on insufficient_quota error', async () => {
      mockChatCreate.mockRejectedValueOnce({ type: 'insufficient_quota' });
      mockPrismaService.mail_Settings.findFirst.mockResolvedValueOnce(null);
      mockMailService.sendMail.mockResolvedValueOnce(true);

      await expect(service.organizeText(mockText, mockCandidate)).rejects.toThrow(
        'You dont have credits. Check your plan/billing.',
      );
    });

    it('should throw on rate_limit_error', async () => {
      mockChatCreate.mockRejectedValueOnce({ type: 'rate_limit_error' });
      await expect(service.organizeText(mockText, mockCandidate)).rejects.toThrow(
        'Rate limit exceeded. Please try again later.',
      );
    });
  });

  describe('generateTextSummary', () => {
    const mockDescription = 'Looking for a senior medical assistant for a busy clinic.';

    it('should throw BadRequestException if OPENAI_API_KEY is not set', async () => {
      delete process.env.OPENAI_API_KEY;
      await expect(service.generateTextSummary(mockDescription)).rejects.toThrow(
        'OPENAI_API_KEY is not defined in environment variables',
      );
    });

    it('should return summary string when OpenAI responds with content', async () => {
      mockChatCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Senior medical assistant role.' } }],
      });

      const result = await service.generateTextSummary(mockDescription);
      expect(result).toBe('Senior medical assistant role.');
    });

    it('should throw on insufficient_quota error', async () => {
      mockChatCreate.mockRejectedValueOnce({ type: 'insufficient_quota' });
      await expect(service.generateTextSummary(mockDescription)).rejects.toThrow(
        'You dont have credits. Check your plan/billing.',
      );
    });

    it('should throw on rate_limit_error', async () => {
      mockChatCreate.mockRejectedValueOnce({ type: 'rate_limit_error' });
      await expect(service.generateTextSummary(mockDescription)).rejects.toThrow(
        'Rate limit exceeded. Please try again later.',
      );
    });

    it('should throw BadRequestException on unexpected error', async () => {
      mockChatCreate.mockRejectedValueOnce(new Error('Network failure'));
      await expect(service.generateTextSummary(mockDescription)).rejects.toThrow(BadRequestException);
    });
  });

  describe('generateAvatarWithScreenshoot', () => {
    const mockCandidate = { id: 'cand-1' };

    beforeEach(() => {
      (fs.createReadStream as jest.Mock).mockReturnValue({});
      (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);
    });

    it('should generate avatar and return imagePath and cost', async () => {
      mockImagesEdit.mockResolvedValueOnce({
        data: [{ b64_json: 'aW1hZ2VkYXRh' }],
      });

      const result = await service.generateAvatarWithScreenshoot(
        mockCandidate,
        '/tmp/screenshot.png',
      );

      expect(result.cost).toBe(0.04);
      expect(result.imagePath).toMatch(/avatarX\.png$/);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should throw Error when result.data is empty or missing b64_json', async () => {
      mockImagesEdit.mockResolvedValueOnce({ data: [] });

      await expect(
        service.generateAvatarWithScreenshoot(mockCandidate, '/tmp/screenshot.png'),
      ).rejects.toThrow('A resposta da API OpenAI não contém os dados esperados.');
    });
  });
});
