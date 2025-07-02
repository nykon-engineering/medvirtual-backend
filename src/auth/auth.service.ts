import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';

import { UserService } from '../user/user.service';
import { WorkosService } from '../workos/workos.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { generateVerificationCode } from '../utils/generateCode.util'



@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly workosService: WorkosService,
    private readonly mailService: MailService,
    private readonly prisma: PrismaService
  ) {}

    async handleUser(code: string): Promise<string> {
      const timeToExpires= Number(process.env.TOKEN_TIME_EXPIRED) | 60 * 60 * 100;
        if (!code) {
            throw new BadRequestException('Code is required');
        }
        const result = await this.workosService.getUserByCode(code);
        if (!result) {
            throw new BadRequestException('Failed to retrieve user profile from WorkOS');
        }

        const user = result.user;

        let userDB = await this.userService.findByEmail(user.email);

        if (!userDB) {
          userDB = await this.userService.create({
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
            role: user.role?.slug || 'user',
            workosId: user.id,
            password: '', // Password is not used for SSO users
            status: 'active',
            authenticationMethod: result.authenticationMethod,
            organizationId: result.organizationId || 'default',
          });
        }
        const token = jwt.sign({id: userDB.id}, process.env.JWT_SECRET, {
          expiresIn: '1h',
        });

        //revoke previous sessions of this user before I create the new session
        await this.prisma.session.updateMany({
          where: { userId: user.id },
          data: { isRevoked: true },
        });

        const session = await this.prisma.session.create({
          data:{
            userId: userDB.id,
            token: token,
            expiresAt: new Date(Date.now() + timeToExpires), // 1 hour from now
          }
        })

        if (!session) {
          throw new BadRequestException('Failed to create session');
        }
        
        return token;
  }

  async workOsSignIn(): Promise<string> {
    const authorizationUrl = await this.workosService.getUrl();
    if (!authorizationUrl) {
      throw new Error('Failed to generate authorization URL');
    }
    return authorizationUrl;
  }

  async signIn(data: any): Promise<string> {
    const timeToExpires= Number(process.env.TOKEN_TIME_EXPIRED) | 60 * 60 * 100;
    const authenticationMethod = 'OwnSign'
    const user = await this.userService.findByEmail(data.email);
    if (!user) {
      throw new UnauthorizedException('User not found with this email');
    }

    if (user.authenticationMethod !== authenticationMethod) {
      throw new UnauthorizedException('User does not use this authentication method. You need to Sign in with the first method you have used');
    }

    const isMatch = await bcrypt.compare(data.password, user.password);
    if (!isMatch) {
      throw new BadRequestException('Invalid password');
    }
    
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    //revoke previous sessions of this user before I create the new session
    await this.prisma.session.updateMany({
      where: { userId: user.id },
      data: { isRevoked: true },
    });

    const session = await this.prisma.session.create({
      data:{
        userId: user.id,
        token: token,
        expiresAt: new Date(Date.now() + timeToExpires), // 1 hour from now
      }
    })

    if (!session) {
      throw new BadRequestException('Failed to create session');
    }

    return token;
  }

  async signUp(data: any): Promise<string> {
    const authenticationMethod = 'OwnSign'
    const user = await this.userService.findByEmail(data.email);
  
    if (user) {
      throw new BadRequestException('User already exists with this email');
    }
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const newUser = await this.userService.create({
      email: data.email,
      name: `${data.firstName} ${data.lastName}`,
      role: data.role || 'user',
      workosId: 'default',
      password: hashedPassword,
      status: 'active',
      authenticationMethod: authenticationMethod,
      organizationId: 'default',
    });
    
    const code = generateVerificationCode(6);
    if (!code){
      throw new BadRequestException('Failed to generate verification code');
    }

    const mailSent = await this.mailService.sendMail(
    {
      to:data.email,
      subject: 'Verification Code',
      text: `Your verification code is: ${code}`,
    });
    return code;
  }

  async logout (token: string): Promise<boolean> {
    if (!token) {
      throw new BadRequestException('Token is required');
    }
    
    const revodeToken = await this.prisma.session.updateMany({
      where: { token },
      data: { isRevoked: true },
    });

    if (!revodeToken) {
      throw new BadRequestException('Failed to revoke token');
    }

    return true;

  }

}
