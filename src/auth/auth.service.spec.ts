import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { WorkosService } from '../workos/workos.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

describe('Invitate new user from email', () => {
  let service: AuthService;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService, UserService, WorkosService, PrismaService, MailService],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  const currentUser = {
    id: "8798d",
    email: "test@test.com",
    organizationId: null,
    first_name: "FirstNameExample",
    last_name: "LastNameExample",
    phone: "",
    avatar: "",
    jobTitle: "",
    companyName: "",
    role: "RoleExample",
    workosId: "",
    password: "",
    authenticationMethod: "OwnSign",
    status: "active",
    verified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('should return 400 if the email or role is invalid', async () => {
    const dataFake = {email: "", role: "RoleExample", firstName: "FirstNameExample", lastName: "LastNameExample", jobTitle: "JobTitleExample", companyName: "CompanyNameExample"};

    await expect(service.inviteUser(dataFake, currentUser)).rejects.toThrowError('Email or role are invalid');
  });


  it('should return 409 if this user already exists', async () => {
    const dataFake = {email: "test@test.com", role: "RoleExample", firstName: "FirstNameExample", lastName: "LastNameExample", jobTitle: "JobTitleExample", companyName: "CompanyNameExample"};
    const userFake = {email: "test@test.com", role: "RoleExample", firstName: "FirstNameExample", lastName: "LastNameExample", jobTitle: "JobTitleExample", companyName: "CompanyNameExample"};

    service['user'].findByEmail = jest.fn().mockResolvedValue(userFake); // Mock a user found with this email
    await expect(service.inviteUser(dataFake, currentUser)).rejects.toThrowError('User already exists');
  });

  it ('should return 201 if the invitation was sent successfully', async () => {
    const dataFake = {email: "test@test.com", role: "RoleExample", firstName: "FirstNameExample", lastName: "LastNameExample", jobTitle: "JobTitleExample", companyName: "CompanyNameExample"};

    service['user'].findByEmail = jest.fn().mockResolvedValue({}); // Mock a user not found with this email
    await expect(service.inviteUser(dataFake, currentUser)).resolves.toEqual(true);
  });


})