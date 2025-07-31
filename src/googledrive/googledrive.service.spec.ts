import { Test, TestingModule } from '@nestjs/testing';
import { GoogledriveService } from './googledrive.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaMock = {
  googletoken: {
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
};

describe('GoogledriveService', () => {
  let service: GoogledriveService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GoogledriveService,
        {provide: PrismaService, useValue: prismaMock},
      ],
    }).compile();

    service = module.get<GoogledriveService>(GoogledriveService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
