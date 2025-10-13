import { Test, TestingModule } from '@nestjs/testing';
import { StaffService } from './staff.service';
import { PrismaService } from '../prisma/prisma.service';
import { HandlerObjectCreation } from '../hubspot/handlers/objectCreation';

describe('StaffService', () => {
  let service: StaffService;
  let prisma: PrismaService;

  const mockPrisma = {
    staff: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    }
  }

  const HandlerObjectCreationMock = {
    execute: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StaffService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: HandlerObjectCreation, useValue: HandlerObjectCreationMock }
      ],
    }).compile();

    service = module.get<StaffService>(StaffService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
