import { Test, TestingModule } from '@nestjs/testing';
import { RecoverypassService } from './recoverypass.service';
import { UserService } from '../user/user.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

import * as jwt from 'jsonwebtoken';
import { Module } from '@nestjs/common';
import { hash, verify } from 'crypto';

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

describe('Forgot password', () => {

  let service: RecoverypassService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RecoverypassService, UserService, PrismaService, MailService],
      imports: [ ],
    }).compile();

    service = module.get<RecoverypassService>(RecoverypassService);
  });


  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return 400 if email is empty', async () => {
    const email = { email: '' }; //pass the parameter as an object

    await expect(service.forgotPassword(email)).rejects.toThrow('Email is required'); //verify that the error is thrown
  })

  it ('Should return 404 if the user does not exist', async () => {
    const email = "teste@teste.com";

    service['user'].findByEmail = jest.fn().mockResolvedValue(null); // Mock a result null as the user does not exist
    const result = service.forgotPassword({email}); //pass the parameter as an object
    
    await expect(result).rejects.toThrow('User with this email does not exist'); //verify that the error is thrown
  });

  it('Should return 400 if there issue in generate code', async () => {
    const fakeUser = { id: 1, email : 'paulo@paulo.com', name: 'Paulo' };

    service['user'].findByEmail = jest.fn().mockResolvedValue(fakeUser); // Mock a user found

    (jwt.sign as jest.Mock).mockReturnValue(null); //simulate an error in generating the JWT

    await expect(service.forgotPassword({email: fakeUser.email})).rejects.toThrow('Error generating recovery hash'); //verify that the error is thrown

  });

  it ('should return 400 if there issue in sending email', async () =>{
    const fakeUser = { id: 1, email : 'paulo@paulo.com', name: 'Paulo' };
    const fakeHash = 'fakeHash123';

    service['user'].findByEmail = jest.fn().mockResolvedValue(fakeUser); // Mock a user found
    (jwt.sign as jest.Mock).mockReturnValue(fakeHash); //simulate a successful JWT generation
    service['mail'].sendMail = jest.fn().mockResolvedValue(false); // Mock email sending failure

    await expect(service.forgotPassword({email: fakeUser.email})).rejects.toThrow('Error sending recovery email'); //verify that the error is thrown
  })

  it ('should return 200 if the user exists and the email is sent', async () => {
    const fakeUser = { id: 1, email : 'paulo@paulo.com', name: 'Paulo' };
    const fakeHash = 'fakeHash123';

    service['user'].findByEmail = jest.fn().mockResolvedValue(fakeUser); // Mock a user found
    (jwt.sign as jest.Mock).mockReturnValue(fakeHash); //simulate a successful JWT generation
    service['mail'].sendMail = jest.fn().mockResolvedValue(true); // Mock email sending true

    await expect(service.forgotPassword({email: fakeUser.email})).resolves.toBe(true); //verify that the function returns true

  })

});

describe('reset password', () => {

  let service2: RecoverypassService;
  beforeEach(async() => {
    const module2: TestingModule = await Test.createTestingModule({
      providers: [RecoverypassService, UserService, PrismaService, MailService],
      imports: [],
    }).compile();

    service2 = module2.get<RecoverypassService>(RecoverypassService);
  })

  it ('Should return 400 if the hash is empty', async () =>{
    const dataFake = { hash: '', newPassword: 'newPassword123' };

    expect(service2.resetPassword(dataFake)).rejects.toThrow('Hash is required'); //verify that the error is thrown
  });

  it ('should return 400 if new password is empty', () => {
    const dataFake = {hash: 'validHash123', newPassword: ''};

    expect(service2.resetPassword(dataFake)).rejects.toThrow('New password is required'); //verify that the error is thrown
  });

  it ('should return not found if the user does not exist in the hash', async () =>{
    const dataFake = { hash: 'validHash123', newPassword: 'newPassword123' };
    const userFake = null;

    (jwt.verify as jest.Mock).mockReturnValue({}); //SIMULATE A VALID TOKEN, BUT WITHOUT USER ID

    expect(service2.resetPassword(dataFake)).rejects.toThrow('User ID not found in hash'); //verify that the error is thrown

  });

  it ('should return 400 if the hash is expired or invalid', () => {
    const dataFake = { hash: 'validHash123', newPassword: 'newPassword123' };
    const userFake = {id: "1", email: "test@test.com", name: "Test User"};

    service2['user'].findByEmail = jest.fn().mockResolvedValue(userFake); // Mock a user found
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error('Invalid token'); // Simulate an error in token verification
    });

    expect(service2.resetPassword(dataFake)).rejects.toThrow('Hash is expired or invalid'); //verify that the error is thrown
  });

  it ('should return 200 if the password is reset successfully', () => {
    const dataFake = { hash: 'validHash123', newPassword: 'newPassword123' };
    const userFake = {id: "1", email: "test@test.com", name: "Test User"};

    service2['user'].findByEmail = jest.fn().mockResolvedValue(userFake); // Mock a user found

    (jwt.verify as jest.Mock).mockReturnValue({ id: userFake.id }); 
    service2['prisma'].user.update = jest.fn().mockResolvedValue({}); 
    service2['mail'].sendMail = jest.fn().mockResolvedValue(true); 
    expect(service2.resetPassword(dataFake)).resolves.toBe(true); 
  })
})