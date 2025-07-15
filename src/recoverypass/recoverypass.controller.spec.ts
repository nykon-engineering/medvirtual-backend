import { Test, TestingModule } from '@nestjs/testing';
import { RecoverypassController } from './recoverypass.controller';
import { RecoverypassService } from './recoverypass.service';

//

describe('Forgot your password', () => {


  let controller: RecoverypassController;

  const ReconveryMock = {
    forgotPassword: jest.fn(),
    setPassword: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecoverypassController],
      providers: [
        {provide: RecoverypassService, useValue: ReconveryMock}
      ],
    }).compile();

    controller = module.get<RecoverypassController>(RecoverypassController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

});