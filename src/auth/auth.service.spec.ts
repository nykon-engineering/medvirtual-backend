import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkosService } from '../workos/workos.service';
import { generateVerificationCode } from '../common/utils/generateCode.util';

import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { first } from 'rxjs';

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mocked-jwt-token'),
  verify: jest.fn(() =>  'mocked-jwt-token-verify' )
}));

jest.mock('../common/utils/generateCode.util', () => ({
  generateVerificationCode: jest.fn(),
}))

jest.mock('bcryptjs', () => ({
  hash: jest.fn(() => 'hashed-password'),
  compare: jest.fn(() => true),
}));

describe('AuthService - handleUser', () => {
  
  let service: AuthService;
  let prisma: PrismaService;
  let workOS: WorkosService;
  let user: UserService;

  beforeEach(async () => {

    const workOSmock = {
      getUser: jest.fn(),
    }

    const prismaMock  = {
      session: {
        updateMany: jest.fn(),
        create: jest.fn(),
      },
    };

    const userMock = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    }

    const module : TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: userMock },
        { provide: MailService, useValue: {} },
        { provide: PrismaService, useValue: prismaMock },
        { provide: WorkosService, useValue: workOSmock }, // vazio se não usar
      ],
    }).compile();
  
    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    workOS = module.get<WorkosService>(WorkosService);
    user = module.get<UserService>(UserService);
  })

  //should return 400 if the code is not provided
  //should return 400 if workOS return is invalid
  //should return 400 if the session is not created
  //should return 200 if everything is ok

  it('should return 400 if the code is not provided', async () => {  
    await expect(service.handleUser('')).rejects.toThrow(
      new BadRequestException('Code is required')
    )
  })

  it('should return 400 if workOS return is invalid', async () => {
    const code = 'invalid-code';
    workOS.getUserByCode = jest.fn().mockResolvedValue(null),

    await expect(service.handleUser(code)).rejects.toThrow(
      new BadRequestException('Failed to retrieve user profile from WorkOS')
    );
  })

  it('should return 400 if the session is not created', async () => {
    const code = 'valid-code';
    workOS.getUserByCode = jest.fn().mockResolvedValue({ user: { id: '1', email: 'test@test.com'} });
    user.findByEmail = jest.fn().mockResolvedValue({})
   
    jest.spyOn(jwt, 'sign').mockImplementation(() => 'mocked-jwt-token');

    prisma.session.updateMany = jest.fn().mockResolvedValue({ count: 0 });
    prisma.session.create = jest.fn().mockResolvedValue(null);

    await expect(service.handleUser(code)).rejects.toThrow(
      new BadRequestException('Failed to create session')
    );
  })

  it('should return 200 if everything is ok', async () => {
    const code = 'valid-code';
    workOS.getUserByCode = jest.fn().mockResolvedValue({ user: { id: '1', email: 'test@test.com'} });
    user.findByEmail = jest.fn().mockResolvedValue({})
   
    jest.spyOn(jwt, 'sign').mockImplementation(() => 'mocked-jwt-token');

    prisma.session.updateMany = jest.fn().mockResolvedValue({ count: 0 });
    prisma.session.create = jest.fn().mockResolvedValue(true);

    await expect(service.handleUser(code)).resolves.toEqual('mocked-jwt-token')
  })

})

describe('AuthService - WorkOsSign', () => {
  let service: AuthService;
  let workOS: WorkosService;

  beforeEach(async () => {
    const workosmock ={
      getUrl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers:[
        AuthService,
        { provide: UserService, useValue: {} },
        { provide: MailService, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: WorkosService, useValue: workosmock },
      ]
    }).compile();

    service = module.get<AuthService>(AuthService);
    workOS = module.get<WorkosService>(WorkosService);
  });

  //shoul return error if the url is not generated
  //should return 200 if the url is generated

  it ('should return error if the url is not generated', async () => {
    workOS.getUrl = jest.fn().mockReturnValue(null);

    await expect(service.workOsSignIn()).rejects.toThrow(
      new Error('Failed to generate authorization URL'),
    );
  })
})

describe('AuthService - signIn', () => {
  let service: AuthService;
  let user: UserService;
  let prisma: PrismaService;

  const userMock = {
    create: jest.fn(),
    findByEmail: jest.fn(),
  };

  const mailMock = { sendMail: jest.fn() };

  const prismaMock = {
    session: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: userMock },
        { provide: MailService, useValue: mailMock },
        { provide: PrismaService, useValue: prismaMock },
        { provide: WorkosService, useValue: {} },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    user = module.get<UserService>(UserService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  const dataFake = { email: 'test@test.com', password: 'testpassword' };
  const authenticationMethod = 'OwnSign';

  it('should throw if user not found', async () => {
    userMock.findByEmail.mockResolvedValue(null);

    await expect(service.signIn(dataFake)).rejects.toThrow(
      new UnauthorizedException('User not found with this email'),
    );
  });

  it('should throw if user is deleted', async () => {
    userMock.findByEmail.mockResolvedValue({ status: 'deleted' });

    await expect(service.signIn(dataFake)).rejects.toThrow(
      new UnauthorizedException('This user does not have permission to log in.'),
    );
  });

  it('should throw if user has no organization', async () => {
    userMock.findByEmail.mockResolvedValue({
      id: 'u1',
      status: 'active',
      organization_id: null,
    });

    await expect(service.signIn(dataFake)).rejects.toThrow(
      new UnauthorizedException('User does not belong to any organization. Please contact support.'),
    );
  });

  it('should throw if organization not found or deleted', async () => {
    userMock.findByEmail.mockResolvedValue({
      id: 'u1',
      status: 'active',
      organization_id: 'org1',
    });
    prismaMock.organization.findUnique.mockResolvedValue({ status: 'deleted' });

    await expect(service.signIn(dataFake)).rejects.toThrow(
      new UnauthorizedException('User organization not found or deleted. Please contact support.'),
    );
  });

  it('should throw if user has wrong auth method', async () => {
    userMock.findByEmail.mockResolvedValue({
      id: 'u1',
      organization_id: 'org1',
      authentication_method: 'different',
      status: 'active',
    });
    prismaMock.organization.findUnique.mockResolvedValue({ status: 'active' });

    await expect(service.signIn(dataFake)).rejects.toThrow(
      new UnauthorizedException(
        'User does not use this authentication method. You need to Sign in with the first method you have used',
      ),
    );
  });

  it('should throw if user is not verified', async () => {
    userMock.findByEmail.mockResolvedValue({
      id: 'u1',
      organization_id: 'org1',
      authentication_method: authenticationMethod,
      verified: false,
      status: 'active',
    });
    prismaMock.organization.findUnique.mockResolvedValue({ status: 'active' });

    await expect(service.signIn(dataFake)).rejects.toThrow(
      new UnauthorizedException('User not verified'),
    );
  });

  it('should throw if password is invalid', async () => {
    userMock.findByEmail.mockResolvedValue({
      id: 'u1',
      email: dataFake.email,
      password: 'hashed-pass',
      authentication_method: authenticationMethod,
      verified: true,
      status: 'active',
      organization_id: 'org1',
    });
    prismaMock.organization.findUnique.mockResolvedValue({ status: 'active' });

    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(service.signIn(dataFake)).rejects.toThrow(
      new BadRequestException('Invalid password'),
    );
  });

  it('should throw if session creation fails', async () => {
    userMock.findByEmail.mockResolvedValue({
      id: 'u1',
      email: dataFake.email,
      password: 'hashed-pass',
      authentication_method: authenticationMethod,
      verified: true,
      status: 'active',
      organization_id: 'org1',
    });
    prismaMock.organization.findUnique.mockResolvedValue({ status: 'active' });

    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (jwt.sign as jest.Mock).mockReturnValue('mocked-token');
    prismaMock.session.updateMany.mockResolvedValue({});
    prismaMock.session.create.mockResolvedValue(null);

    await expect(service.signIn(dataFake)).rejects.toThrow(
      new BadRequestException('Failed to create session'),
    );
  });

  it('should return token and user if everything is ok', async () => {
    const userObj = {
      id: 'u1',
      email: dataFake.email,
      password: 'hashed-pass',
      authentication_method: authenticationMethod,
      verified: true,
      status: 'active',
      organization_id: 'org1',
      first_name: 'Test',
      last_name: 'User',
      role: 'admin',
    };
    userMock.findByEmail.mockResolvedValue(userObj);
    prismaMock.organization.findUnique.mockResolvedValue({ status: 'active' });

    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (jwt.sign as jest.Mock).mockReturnValue('mocked-token');
    prismaMock.session.updateMany.mockResolvedValue({});
    prismaMock.session.create.mockResolvedValue({ id: 'session1' });

    const result = await service.signIn(dataFake);

    expect(result).toEqual({
      statusCode: 200,
      message: 'User authenticated successfully',
      token: 'mocked-token',
      user: {
        firstName: 'Test',
        lastName: 'User',
        email: dataFake.email,
        role: 'admin',
        clientId: 'org1',
      },
    });
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: { isRevoked: true },
    });
  });
});


describe('AuthService - Signup', () => {
  let service: AuthService;
  let user: UserService;
  let mail: MailService
  let prisma: PrismaService

  let userServiceMock = {
    findByEmail: jest.fn(),
  };

  let mailmock = {
    sendMail: jest.fn(),
  }

  let prismamock = {
    emailVerification: {
      create: jest.fn(),
    },
    organization: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  }
  
  const datafake = { 
    firstName: 'Test',
    lastName: 'User',
    password: 'testpassword',
    role: 'User',
    jobTitle: 'Tester',
    companyName: 'TestCompany',
    organizationId: 'org-123`',
    email: 'test@test.com',
    status: 'prospect'
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: userServiceMock },
        { provide: MailService, useValue: mailmock },
        { provide: PrismaService, useValue: prismamock },
        { provide: WorkosService, useValue: {} },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    user = module.get<UserService>(UserService);
    mail = module.get<MailService>(MailService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  //should return 400 if Failed to store verification code
  //should return 200 if everything is ok

  it('should return 400 if User already exists with this email', async () => {
    user.findByEmail = jest.fn().mockResolvedValue({ id: 'existing-userId' });
    await expect(service.signUp(datafake)).rejects.toThrow(
      new BadRequestException('User already exists with this email'),
    )
  });

  it('should return 400 if Failed to create user', async () => {
    user.findByEmail = jest.fn().mockResolvedValue(null);
    prisma.organization.create = jest.fn().mockResolvedValue(true);
    user.create = jest.fn().mockResolvedValue(null);
    

    await expect(service.signUp(datafake)).rejects.toThrow(
      new BadRequestException('Failed to create user'),
    );

  })

  it('should return 400 if Failed to generate verification code', async () => {
    user.findByEmail = jest.fn().mockResolvedValue(null);
    prisma.organization.create = jest.fn().mockResolvedValue(true);
    user.create = jest.fn().mockResolvedValue(true);
    (generateVerificationCode as jest.Mock).mockReturnValue(null);
    await expect(service.signUp(datafake)).rejects.toThrow(
      new BadRequestException('Failed to generate verification code'),
    );

  })

  it('should return 400 if failed to send verification email', async () => {
    user.findByEmail = jest.fn().mockResolvedValue(null);
    prisma.organization.create = jest.fn().mockResolvedValue(true);
    user.create = jest.fn().mockResolvedValue(true);
    (generateVerificationCode as jest.Mock).mockReturnValue('12345');
    mail.sendMail = jest.fn().mockResolvedValue(false);

    await expect(service.signUp(datafake)).rejects.toThrow(
      new BadRequestException('Failed to send verification email'),
    );
  })
  
  it('should return 400 if failed to store verification code', async() => {
    user.findByEmail = jest.fn().mockResolvedValue(null);
    prisma.organization.create = jest.fn().mockResolvedValue(true);
    user.create = jest.fn().mockResolvedValue(true);
    (generateVerificationCode as jest.Mock).mockReturnValue('12345');
    mail.sendMail = jest.fn().mockResolvedValue(true);

    prisma.emailVerification.create = jest.fn().mockResolvedValue(null);

    await expect(service.signUp(datafake)).rejects.toThrow(
      new BadRequestException('Failed to store verification code'),
    );    
  })

  it ('should return 200 if everything is ok', async () => {
    user.findByEmail = jest.fn().mockResolvedValue(null);
    prisma.organization.create = jest.fn().mockResolvedValue(true);
    user.create = jest.fn().mockResolvedValue(true);
    (generateVerificationCode as jest.Mock).mockReturnValue('12345');
    mail.sendMail = jest.fn().mockResolvedValue(true);

    prisma.emailVerification.create = jest.fn().mockResolvedValue(true);

    jest.spyOn(jwt, 'sign').mockImplementation(() => 'mocked-jwt-token');

    await expect(service.signUp(datafake)).resolves.toEqual({
      token: 'mocked-jwt-token'
    })
  })

})

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
      companyName: 'Company',
      organizationId: 'org-123',
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
      companyName: 'Company',
      organizationId: 'org-123',
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

describe('AuthService - getUser', () => {

  let service: AuthService;
  let prisma: PrismaService;

  beforeEach(async () =>{

    const prismamock = {
      emailInvitation: {
        findFirst: jest.fn(),
      },
      uSER: {
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
    await expect(service.getUser({ token : ''})).rejects.toThrow(
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

    await expect(service.getUser({ token: 'valid-token'})).rejects.toThrow(
      new BadRequestException('Token not found!'),
    );
  });

  it('should return 404 if the user is not found', async () => {
    (jwt.verify as jest.Mock).mockImplementation(() => {
      return { id: 'UserIdfake' };
    });
    prisma.emailInvitation.findFirst = jest.fn().mockResolvedValue(true);
    prisma.uSER.findFirst = jest.fn().mockResolvedValue(false);

    await expect(service.getUser({ token: 'valid-token'})).rejects.toThrow(
      new BadRequestException('User not found!'),
    );
  })

  it('should return user object if everything is ok', async () => {
    (jwt.verify as jest.Mock).mockImplementation(() => {
      return { id: 'UserIdfake' };
    });
    prisma.emailInvitation.findFirst = jest.fn().mockResolvedValue(true);
    prisma.uSER.findFirst = jest.fn().mockResolvedValue(true);

    const result = await service.getUser({ token: 'valid-token'});
    expect(result).toBeTruthy(); // Assuming the user object is returned as true for simplicity
  })

  
})

describe('AuthService - invitedUserSignup', () => {
  let service: AuthService;
  let prisma: PrismaService;

  beforeEach(async () => {

    const prismamock = {
      emailInvitation: {
        findFirst: jest.fn(),
      },
      uSER: {
        findFirst: jest.fn(),
      },
      session:{
        updateMany: jest.fn(),
        create: jest.fn(),
      }
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

    await expect(service.getUser({ token: 'valid-token'})).rejects.toThrow(
      new BadRequestException('Token not found!'),
    );
  });

  it('should return 404 if the user is not found', async () => {
    (jwt.verify as jest.Mock).mockImplementation(() => {
      return { id: 'UserIdfake' };
    });
    prisma.emailInvitation.findFirst = jest.fn().mockResolvedValue(true);
    prisma.uSER.findFirst = jest.fn().mockResolvedValue(false);

    await expect(service.getUser({ token: 'valid-token'})).rejects.toThrow(
      new BadRequestException('User not found!'),
    );
  })

  it('should return 400 if there error in set user password', async () => {
    const dataFake = {
      token: 'valid-token',
      password: 'valid-password',
      confirmPassword: 'valid-password',
      firstName: 'Test',
      lastName: 'User',
      jobTitle: 'Tester',
      status: 'prospect'
    };
    (jwt.verify as jest.Mock).mockImplementation(() => {
      return { id: 'UserIdfake' };
    });
    prisma.emailInvitation.findFirst = jest.fn().mockResolvedValue(true);
    prisma.uSER.findFirst = jest.fn().mockResolvedValue(true);
    prisma.uSER.update = jest.fn().mockResolvedValue(false);

    await expect(service.invitedUserSignup(dataFake)).rejects.toThrow(
      new BadRequestException('Error in set user password'),
    );
  })

  it('should return message if everything is ok', async () => {
    const dataFake = {
      token: 'valid-token',
      password: 'valid-password',
      confirmPassword: 'valid-password',
      firstName: 'Test',
      lastName: 'User',
      jobTitle: 'Tester',
      status: 'prospect'
    };
    (jwt.verify as jest.Mock).mockImplementation(() => {
      return { id: 'UserIdfake' };
    });
    prisma.emailInvitation.findFirst = jest.fn().mockResolvedValue(true);
    prisma.uSER.findFirst = jest.fn().mockResolvedValue(true);
    prisma.uSER.update = jest.fn().mockResolvedValue(true);

    jest.spyOn(jwt, 'sign').mockImplementation(() => 'mocked-jwt-token');

    prisma.session.updateMany = jest.fn().mockResolvedValue({ count: 1 });
    prisma.session.create = jest.fn().mockResolvedValue(true);

    await expect(service.invitedUserSignup(dataFake)).resolves.toEqual('mocked-jwt-token')

  })
})