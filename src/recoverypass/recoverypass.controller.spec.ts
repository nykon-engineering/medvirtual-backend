import { Test, TestingModule } from '@nestjs/testing';
import { RecoverypassController } from './recoverypass.controller';

//

describe('Forgot your password', () => {

  //should return 404 if the user does not exist

  //shoud return 400 if there issue in generate code
  //should return 400 if there issue in sending email
  //should return 200 if the user exists and the email is sent
  let controller: RecoverypassController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecoverypassController],
    }).compile();

    controller = module.get<RecoverypassController>(RecoverypassController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

});
