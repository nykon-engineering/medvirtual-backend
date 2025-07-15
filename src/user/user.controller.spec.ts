import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { AuthGuard } from '../auth/auth.guard';
import { UserService } from './user.service';

describe('UserController', () => {
  let controller: UserController;

  const userServiceMock = {
    findById: jest.fn(),
    findByOrganizationId: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {provide: UserService, useValue: userServiceMock}
      ]
    })
    .overrideGuard(AuthGuard)
    .useValue({ canActivate: jest.fn(() => true) })
    .compile();

    controller = module.get<UserController>(UserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
