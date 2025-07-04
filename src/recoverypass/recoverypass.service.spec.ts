import { Test, TestingModule } from '@nestjs/testing';
import { RecoverypassService } from './recoverypass.service';
import { UserService } from '../user/user.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

import * as jwt from 'jsonwebtoken';

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
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

