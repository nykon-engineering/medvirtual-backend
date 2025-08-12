import { Test, TestingModule } from '@nestjs/testing';
import { HireRequestService } from './hire-request.service';
import { PrismaService } from '../prisma/prisma.service';


const prismaMock = {
  hireRequest: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};
describe('HireRequestService', () => {
  let service: HireRequestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HireRequestService,
        {provide: PrismaService, useValue: prismaMock},
      ],
    }).compile();

    service = module.get<HireRequestService>(HireRequestService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
