import { Test, TestingModule } from '@nestjs/testing';
import { OpenaiService } from './openai.service';
import { MailService } from '../mail/mail.service';

const mockMailService = {
  sendMail: jest.fn(),
};

describe('OpenaiService', () => {
  let service: OpenaiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OpenaiService,
        { provide: MailService, useValue: mockMailService }
      ],
    }).compile();

    service = module.get<OpenaiService>(OpenaiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
