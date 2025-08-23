import { Test, TestingModule } from '@nestjs/testing';
import { GooglesheetService } from './googlesheet.service';

describe('GooglesheetService', () => {
  let service: GooglesheetService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GooglesheetService],
    }).compile();

    service = module.get<GooglesheetService>(GooglesheetService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
