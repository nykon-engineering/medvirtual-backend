import { Test, TestingModule } from '@nestjs/testing';
import { RecoverypassService } from './recoverypass.service';

describe('RecoverypassService', () => {
  let service: RecoverypassService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RecoverypassService],
    }).compile();

    service = module.get<RecoverypassService>(RecoverypassService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
