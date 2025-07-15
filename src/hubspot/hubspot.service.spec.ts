import { Test, TestingModule } from '@nestjs/testing';
import { HubspotService } from './hubspot.service';

describe('HubspotService', () => {
  let service: HubspotService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HubspotService],
    }).compile();

    service = module.get<HubspotService>(HubspotService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
