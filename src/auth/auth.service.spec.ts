import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkosService } from '../workos/workos.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { verify } from 'crypto';

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mocked-jwt-token'),
  verify: jest.fn(() =>  'mocked-jwt-token-verify' )
}));

describe('AuthService - inviteUser', () => {
  let service: AuthService;
  let userServiceMock: {
    findByEmail: jest.Mock;
    create: jest.Mock;
  };
  let mailServiceMock: {
    sendMail: jest.Mock;
  };
  let prismaMock: {
    emailInvitation: { create: jest.Mock };
  };

  beforeEach(async () => {
    userServiceMock = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    };

    mailServiceMock = {
      sendMail: jest.fn(),
    };

    prismaMock = {
      emailInvitation: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: userServiceMock },
        { provide: MailService, useValue: mailServiceMock },
        { provide: PrismaService, useValue: prismaMock },
        { provide: WorkosService, useValue: {} }, // vazio se não usar
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });


  it('should throw if user already exists', async () => {
    const dataFake = {
      email: 'test@test.com',
      role: 'RoleExample',
      firstName: 'First',
      lastName: 'Last',
      jobTitle: 'Job',
      companyName: 'Company',
    };

    userServiceMock.findByEmail.mockResolvedValue({ id: 'existing-user-id' });

    await expect(service.inviteUser(dataFake)).rejects.toThrow(
      'User already exists',
    );
  });

  it('should send invitation email successfully', async () => {
    const dataFake = {
      email: 'newuser@test.com',
      role: 'RoleExample',
      firstName: 'First',
      lastName: 'Last',
      jobTitle: 'Job',
      companyName: 'Company',
    };

    userServiceMock.findByEmail.mockResolvedValue(null);
    userServiceMock.create.mockResolvedValue({ id: 'new-user-id' });
    mailServiceMock.sendMail.mockResolvedValue(true);
    prismaMock.emailInvitation.create.mockResolvedValue({ id: 'invite-id' });

    const result = await service.inviteUser(dataFake);

    expect(result).toBe(`Invitation sent successfully to ${dataFake.email}`);
    expect(userServiceMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: dataFake.email,
      }),
    );
    expect(mailServiceMock.sendMail).toHaveBeenCalled();
    expect(prismaMock.emailInvitation.create).toHaveBeenCalled();
  });
});


describe('AuthService - GetInvite', () => {

  let service: AuthService;
  let prisma: PrismaService;

  beforeEach(async () =>{

    const prismamock = {
      emailInvitation: {
        findFirst: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
    }
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: {} },
        { provide: MailService, useValue: {} },
        { provide: PrismaService, useValue: prismamock },
        { provide: WorkosService, useValue: {} }, 
      ],
    }).compile();
    
    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
  })

  it ('should return 400 if the token is not provided', async () => {
    await expect(service.getInvite('')).rejects.toThrow(
      new BadRequestException('Token is required'),
    );
  });

  it('should return 404 if the token is not found', async () => {
    const token= 'tokenFake';
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new UnauthorizedException('Invalid token')
    })
  });

  it('should return 404 if the token is not found', async () => {
    (jwt.verify as jest.Mock).mockImplementation(() => {
      return { id: 'UserIdfake' };
    });
    prisma.emailInvitation.findFirst = jest.fn().mockResolvedValue(null);

    await expect(service.getInvite('valid-token')).rejects.toThrow(
      new BadRequestException('Token not found!'),
    );
  });

  it('should return 404 if the user is not found', async () => {
    (jwt.verify as jest.Mock).mockImplementation(() => {
      return { id: 'UserIdfake' };
    });
    prisma.emailInvitation.findFirst = jest.fn().mockResolvedValue(true);
    prisma.user.findFirst = jest.fn().mockResolvedValue(false);

    await expect(service.getInvite('valid-token')).rejects.toThrow(
      new BadRequestException('User not found!'),
    );
  })

  it('should return user object if everything is ok', async () => {
    (jwt.verify as jest.Mock).mockImplementation(() => {
      return { id: 'UserIdfake' };
    });
    prisma.emailInvitation.findFirst = jest.fn().mockResolvedValue(true);
    prisma.user.findFirst = jest.fn().mockResolvedValue(true);
    const result = await service.getInvite('valid-token');
    expect(result).toBeTruthy(); // Assuming the user object is returned as true for simplicity
  })

  
})

describe('AuthService - SetPassword', () => {
  let service: AuthService;
  let prisma: PrismaService;

  beforeEach(async () => {

    const prismamock = {
      emailInvitation: {
        findFirst: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: {} },
        { provide: MailService, useValue: {} },
        { provide: PrismaService, useValue: prismamock },
        { provide: WorkosService, useValue: {} }, 
      ]
    }).compile();
    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
  })

  it('should return 404 if the token is not found', async () => {
    const token= 'tokenFake';
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new UnauthorizedException('Invalid token')
    })
  });

  it('should return 404 if the token is not found', async () => {
    (jwt.verify as jest.Mock).mockImplementation(() => {
      return { id: 'UserIdfake' };
    });
    prisma.emailInvitation.findFirst = jest.fn().mockResolvedValue(null);

    await expect(service.getInvite('valid-token')).rejects.toThrow(
      new BadRequestException('Token not found!'),
    );
  });

  it('should return 404 if the user is not found', async () => {
    (jwt.verify as jest.Mock).mockImplementation(() => {
      return { id: 'UserIdfake' };
    });
    prisma.emailInvitation.findFirst = jest.fn().mockResolvedValue(true);
    prisma.user.findFirst = jest.fn().mockResolvedValue(false);

    await expect(service.getInvite('valid-token')).rejects.toThrow(
      new BadRequestException('User not found!'),
    );
  })

  it('should return 400 if there error in set user password', async () => {
    const dataFake = {
      token: 'valid-token',
      password: 'valid-password',
      confirmPassword: 'valid-password',
    };
    (jwt.verify as jest.Mock).mockImplementation(() => {
      return { id: 'UserIdfake' };
    });
    prisma.emailInvitation.findFirst = jest.fn().mockResolvedValue(true);
    prisma.user.findFirst = jest.fn().mockResolvedValue(true);
    prisma.user.update = jest.fn().mockResolvedValue(false);

    await expect(service.setPassword(dataFake)).rejects.toThrow(
      new BadRequestException('Error in set user password'),
    );
  })

  it('should return message if everything is ok', async () => {
    const dataFake = {
      token: 'valid-token',
      password: 'valid-password',
      confirmPassword: 'valid-password',
    };
    (jwt.verify as jest.Mock).mockImplementation(() => {
      return { id: 'UserIdfake' };
    });
    prisma.emailInvitation.findFirst = jest.fn().mockResolvedValue(true);
    prisma.user.findFirst = jest.fn().mockResolvedValue(true);
    prisma.user.update = jest.fn().mockResolvedValue(true);

    await expect(service.setPassword(dataFake)).resolves.toBe('Password has been set successfully. You can now log in.')
  })
})