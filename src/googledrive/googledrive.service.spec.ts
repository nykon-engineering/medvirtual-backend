import { Test, TestingModule } from '@nestjs/testing';
import { GoogledriveService } from './googledrive.service';

describe('GoogledriveService', () => {
  let service: GoogledriveService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GoogledriveService],
    }).compile();

    service = module.get<GoogledriveService>(GoogledriveService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
