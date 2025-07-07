import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';

import { UserService } from '../user/user.service';
import { WorkosService } from '../workos/workos.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { generateVerificationCode } from '../utils/generateCode.util'
import { signUpReturnDto } from './dto/signupReturn.dto';
import { resendCodeDto } from './dto/resendCode.dto';
import { SignInDto } from './dto/SignIn.dto';
import { inviteUserDto } from './dto/InviteUser.dto';



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
            organization: result.organizationId ? { connect: { id: result.organizationId } } : undefined,
            first_name: user.first_name,
            last_name: user.last_name,
            phone: user.phone || '',
            avatar: user.profile_picture_url || '',
            jobTitle: user.jobTitle || '',
            companyName: user.companyName || '',
            role: user.role?.slug || 'user',
            workosId: user.id,
            password: '', // Password is not used for SSO users
            authenticationMethod: result.authenticationMethod,
            status: 'incomplete',
            verified: user.email_verified,
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

  async signIn(data: SignInDto): Promise<string> {
    const timeToExpires= Number(process.env.TOKEN_TIME_EXPIRED) || 60 * 60 * 1000;
    const authenticationMethod = 'OwnSign'
    const user = await this.userService.findByEmail(data.email);
    if (!user) {
      throw new UnauthorizedException('User not found with this email');
    }

    if (user.authenticationMethod !== authenticationMethod) {
      throw new UnauthorizedException('User does not use this authentication method. You need to Sign in with the first method you have used');
    }

    if (!user.verified) {
      throw new UnauthorizedException('User not verified');
    }
    console.log(`[${user.password}]`);
    console.log(`[${data.password}]`);

    const isMatch = await bcrypt.compare(data.password, user.password);
    console.log(isMatch);
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

  async signUp(data: any): Promise<signUpReturnDto> {
    const authenticationMethod = 'OwnSign'
    const user = await this.userService.findByEmail(data.email);
  
    if (user) {
      throw new BadRequestException('User already exists with this email');
    }

    const newUser = await this.userService.create({
      email: data.email,
      organization: undefined,
      first_name: data.firstName,
      last_name: data.lastName,
      phone: '',
      avatar: '',
      jobTitle: data.jobTitle,
      companyName: data.companyName,
      role: data.role || 'user',
      workosId: '',
      password: data.password, // Password is not used for SSO users
      authenticationMethod: authenticationMethod,
      status: 'active',
      verified: false, // Initially set to false until the user verifies their email
    })
    
    const code = generateVerificationCode(6);
    if (!code){
      throw new BadRequestException('Failed to generate verification code');
    }

    // Send verification code via email
    /*const mailSent = await this.mailService.sendMail(
    {
      to:data.email,
      subject: 'Verification Code',
      text: `Your verification code is: ${code}`,
    });

    if(!mailSent) { 
      throw new BadRequestException('Failed to send verification email');
    }
    */

    
    // Store the verification code in the database with an expiration time
    const codeExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos
    const storeCode = await this.prisma.emailVerification.create({
        data: {
          userId: newUser.id,
          code: code,
          expiresAt: codeExpiresAt,
        }
      });
    if (!storeCode) {
      throw new BadRequestException('Failed to store verification code');
    }

    return {
      code,
      email: data.email
    };
  }

  async verifyCode(data: signUpReturnDto): Promise<boolean> {
    if (!data.code || !data.email) {
      throw new BadRequestException('Code and email are required');
    }

    const user = await this.userService.findByEmail(data.email);
    if (!user) {
      throw new BadRequestException('User not found with this email');
    }
    //Verify if the code exists for this user
    const verificationCode = await this.prisma.emailVerification.findFirst({
      where: {
        userId: user.id,
        code: data.code,
        verified: false, //return just if the code is not verified yet
      },
    });
    if (!verificationCode) {
      throw new BadRequestException('Invalid verification code');
    }
    if (verificationCode.verified !== false) {
      throw new BadRequestException('Code already verified');
    }

    //Update code status to verified
    const updatedCode = await this.prisma.emailVerification.update({
      where: { id: verificationCode.id },
      data: { verified: true },
    });
    if (!updatedCode) {
      throw new BadRequestException('Failed to verify code');
    }

    //Update user verified to true
    await this.prisma.user.update({
      where:{
        id: user.id,
      },
      data: {
        verified: true,
      }
    })

    return true;
  }

  async resendCode(email: resendCodeDto): Promise<signUpReturnDto> {

    //invalidate previuos code from this user
    if (!email) {
      throw new BadRequestException('Email is required');
    }
    console.log(email);
    const user = await this.userService.findByEmail(email.email);
    if (!user) {
      throw new BadRequestException('User not found with this email');
    }

    //here I need to hash the userId
    const invalidateCode = await this.prisma.emailVerification.updateMany({
      where: {
        userId: user.id,
      },
      data: { 
        verified: true // Mark as verified to invalidate
      }, 
    });
    if (!invalidateCode) {
      throw new BadRequestException('Failed to invalidate previous verification code');
    }

    //generate new code
    const code = generateVerificationCode(6);
    if (!code){
      throw new BadRequestException('Failed to generate verification code');
    }

    const codeExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos
    const storeCode = await this.prisma.emailVerification.create({
        data: {
          userId: user.id,
          code: code,
          expiresAt: codeExpiresAt,
        }
      });
    if (!storeCode) {
      throw new BadRequestException('Failed to store verification code');
    }

    // Send verification code via email
    /*
    const mailSent = await this.mailService.sendMail(
    {
      to:user.email,
      subject: 'Verification Code',
      text: `Your verification code is: ${code}`,
    });

    if (!mailSent) { 
      throw new BadRequestException('Failed to send verification email');
    }
      */
    

    return {
      code,
      email: user.email
    }

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

  async inviteUser(data: inviteUserDto): Promise<boolean>{

    
    return true;
  } 

}
