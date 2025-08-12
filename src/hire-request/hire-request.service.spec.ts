import { Test, TestingModule } from '@nestjs/testing';
import { HireRequestService } from './hire-request.service';

describe('HireRequestService', () => {
  let service: HireRequestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HireRequestService],
    }).compile();

    service = module.get<HireRequestService>(HireRequestService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
