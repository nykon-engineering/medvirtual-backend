import { Test, TestingModule } from '@nestjs/testing';
import { GoogledriveController } from './googledrive.controller';

describe('GoogledriveController', () => {
  let controller: GoogledriveController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoogledriveController],
    }).compile();

    controller = module.get<GoogledriveController>(GoogledriveController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
