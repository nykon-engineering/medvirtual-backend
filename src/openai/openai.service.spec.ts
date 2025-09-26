import { Test, TestingModule } from '@nestjs/testing';
import { OpenaiService } from './openai.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

const mockMailService = {
  sendMail: jest.fn(),
};
const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('OpenaiService', () => {
  let service: OpenaiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OpenaiService,
        { provide: MailService, useValue: mockMailService },
        { provide: PrismaService, useValue: mockPrismaService }
      ],
    }).compile();

    service = module.get<OpenaiService>(OpenaiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
