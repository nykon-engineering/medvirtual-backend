import { Test, TestingModule } from '@nestjs/testing';
import { WorkosService } from './workos.service';

describe('WorkosService', () => {
  let service: WorkosService;

  process.env.WORKOS_API_KEY = 'fake_key';
  process.env.WORKOS_CLIENT_ID = 'fake_client_id';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WorkosService],
    }).compile();

    service = module.get<WorkosService>(WorkosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
