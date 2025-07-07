import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { first } from 'rxjs';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});


describe('Invitate new user from email', () => {
  let service: AuthService;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });


  it('should return 400 if the email or role is invalid', async () => {
    const dataFake = {email: "", role: "RoleExample", firstName: "FirstNameExample", lastName: "LastNameExample"};

    await expect(service.inviteUser(dataFake)).rejects.toThrowError('Email or role are invalid');

  });


  it('should return 409 if this user already exists', async () => {
    const dataFake = {email: "test@test.com", role: "RoleExample", firstName: "FirstNameExample", lastName: "LastNameExample"};
    const userFake = {email: "test@test.com", role: "RoleExample", firstName: "FirstNameExample", lastName: "LastNameExample"};

    service['user'].findByEmail = jest.fn().mockResolvedValue(userFake); // Mock a user found with this email

    await expect(service.inviteUser(dataFake)).rejects.toThrowError('User already exists');


  });

  it ('should return 201 if the invitation was sent successfully', async () => {
    const dataFake = {email: "test@test.com", role: "RoleExample", firstName: "FirstNameExample", lastName: "LastNameExample"};

    service['user'].findByEmail = jest.fn().mockResolvedValue({}); // Mock a user not found with this email

    await expect(service.inviteUser(dataFake)).resolves.toEqual(true);


  });


})