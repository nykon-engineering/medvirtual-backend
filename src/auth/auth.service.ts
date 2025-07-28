import { BadRequestException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';

import { UserService } from '../user/user.service';
import { WorkosService } from '../workos/workos.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { generateVerificationCode } from '../common/utils/generateCode.util'
import { AuthSignUpReturnDto } from './dto/authSignupReturn.dto';
import { AuthResendCodeDto } from './dto/authResendCode.dto';
import { AuthSignInDto } from './dto/authSignIn.dto';
import { AuthInviteUserDto } from './dto/authInviteUser.dto';
import { AuthVerifyCodeDto } from './dto/authVerifyCode.dto';
import getVerificationCodeTemplate from '../common/utils/email-templates/verification-code';
import InviteSignup from '../common/utils/email-templates/invite-signup';
import { AuthSignUpDto } from './dto/authSignUp.dto';
import { AuthVerifyCodeDtoReturn } from './dto/authVerifyCodeReturn.dto';
import { AuthinvitedUserSignupDto } from './dto/invitedUserSignup.dto';
import { AuthLogoutDto } from './dto/authLogOut.dto';
import { AuthGetInviteDto } from './dto/authGetInvite.dto';
import { AuthResendCodeReturnDto } from './dto/authResendCodeReturn.dto';
import { AuthUpdatePasswordDto } from './dto/authSetPassword.dto';


@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly workosService: WorkosService,
    private readonly mailService: MailService,
    private readonly prisma: PrismaService
  ) {}


  async workOsSignIn(): Promise<string> {
    const authorizationUrl = await this.workosService.getUrl();
    if (!authorizationUrl) {
      throw new Error('Failed to generate authorization URL');
    }
    //console.log('workos route:', authorizationUrl);
    return authorizationUrl;
  }

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
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          phone: user.phone || '',
          avatar: user.profile_picture_url || '',
          job_title: user.jobTitle || '',
          organization_name: user.companyName || '',
          role: user.role?.slug || 'user',
          workos_id: user.id,
          password: '', // Password is not used for SSO users
          authentication_method: result.authenticationMethod,
          status: 'incomplete',
          verified: user.email_verified || false,
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


  async signIn(data: AuthSignInDto): Promise<string> {
    const timeToExpires= Number(process.env.TOKEN_TIME_EXPIRED) || 60 * 60 * 1000;
    const authenticationMethod = 'OwnSign'
    const user = await this.userService.findByEmail(data.email);
    if (!user) {
      throw new UnauthorizedException('User not found with this email');
    }

    if (user.authentication_method !== authenticationMethod) {
      throw new UnauthorizedException('User does not use this authentication method. You need to Sign in with the first method you have used');
    }

    if (!user.verified) {
      throw new UnauthorizedException('User not verified');
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

  async signUp(data: AuthSignUpDto): Promise<AuthSignUpReturnDto> {
    const authenticationMethod = 'OwnSign'
    const user = await this.userService.findByEmail(data.email);
  
    if (user) {
      throw new BadRequestException('User already exists with this email');
    }

    //when a user use the direct signup route, it means that this user don't have organization previously created
    const organization = await this.prisma.organization.create({
      data: {
        name: data.companyName || 'Default Organization',
        
      },
    })

    const newUser = await this.userService.create({
      email: data.email,
      organization: { connect: { id: organization.id } },
      first_name: data.firstName,
      last_name: data.lastName,
      phone: '',
      avatar: '',
      job_title: data.jobTitle,
      organization_name: data.companyName,
      role: data.role || 'user',
      workos_id: '',
      password: data.password, // Password is not used for SSO users
      authentication_method: authenticationMethod,
      status: 'active',
      verified: false, // Initially set to false until the user verifies their email
    })
    if (!newUser) {
      throw new BadRequestException('Failed to create user');
    }
    
    const code = generateVerificationCode(6);
    if (!code){
      throw new BadRequestException('Failed to generate verification code');
    }

    // Send verification code via email
    const emailBody = getVerificationCodeTemplate(code);
    const mailSent = await this.mailService.sendMail(
    {
      from: 'MedVirtual <noreply@medvirtual.ai>',
      to: data.email,
      subject: 'Verification Code',
      html: emailBody,
    });
   
    if(!mailSent) { 
      throw new BadRequestException('Failed to send verification email');
    }
    
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

    const token = jwt.sign({ id: newUser.id }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    return {
      token:token,
    };
  }

  async verifyCode(data: AuthVerifyCodeDto): Promise<AuthVerifyCodeDtoReturn> {
    if (!data.code || !data.token) {
      throw new BadRequestException('Code and token are required');
    }

    //Verify if the token is valid
    let decodedToken; 
    try {
      decodedToken = jwt.verify(data.token, process.env.JWT_SECRET);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }

    const user = await this.userService.findById(decodedToken.id);
    if (!user) {
      throw new BadRequestException('User not found');
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
    await this.prisma.uSER.update({
      where:{
        id: user.id,
      },
      data: {
        verified: true,
      }
    })

    //Create a new JWT for keep the user logged in
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
        expiresAt: new Date(Date.now() +  Number(process.env.TOKEN_TIME_EXPIRED) || 60 * 60 * 1000), 
      }
    })

    if (!session) {
      throw new BadRequestException('Failed to create session');
    }
    return token;
  }

  async resendCode(data: AuthResendCodeDto): Promise<AuthResendCodeReturnDto> {
    if (!data.token) {
      throw new BadRequestException('Token are required');
    }
    //Verify if the token is valid
    let decodedToken; 
    try {
      decodedToken = jwt.verify(data.token, process.env.JWT_SECRET);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }

    const user = await this.userService.findById(decodedToken.id);
    if (!user) {
      throw new BadRequestException('User not found');
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
    const emailBody = getVerificationCodeTemplate(code);
    const mailSent = await this.mailService.sendMail(
    {
      from: 'MedVirtual <noreply@medvirtual.ai>',
      to: user.email,
      subject: 'Verification Code',
      html: emailBody,
    });
   
    if(!mailSent) { 
      throw new BadRequestException('Failed to send verification email');
    }
    

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    return {
      token:token,
    };

  }

  async logout (data: AuthLogoutDto): Promise<boolean> {
    const {token} = data;
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

  async inviteUser(data: AuthInviteUserDto): Promise<string>{
    const authenticationMethod = 'OwnSign'
    const user = await this.userService.findByEmail(data.email);
    if (user) {
      throw new BadRequestException('User already exists');
    }


    const newUser = await this.userService.create({
      email: data.email,
      organization: { connect: { id: data.organizationId } }, 
      first_name: '',
      last_name: '',
      phone: '',
      avatar: '',
      job_title: '',
      organization_name: data.companyName,
      role: data.role || 'user',
      workos_id: '',
      password: '', // Password is not used for SSO users
      authentication_method: authenticationMethod,
      status: 'invited',
      verified: false, // Initially set to false until the user verifies their email
    })

    const code = jwt.sign({ id: newUser.id }, process.env.JWT_SECRET, {
      expiresIn: '24h',
    });

    if (!code){
      throw new BadRequestException('Failed to generate invite code');
    }

    // Send signup link via email
    const inviteLink = `${process.env.FRONTEND_URL}/invite-signup?code=${code}`;
    const emailBody = InviteSignup(inviteLink);
    const mailSent = await this.mailService.sendMail(
    {
      from: 'MedVirtual <noreply@medvirtual.ai>',
      to: data.email,
      subject: 'MedVirtual Invitation',
      html: emailBody,
    });
   
    if(!mailSent) { 
      throw new BadRequestException('Failed to send invitation email');
    }

    // Store the verification code in the database with an expiration time
    const codeExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours - same time as JWT
    const storeCode = await this.prisma.emailInvitation.create({
        data: {
          userId: newUser.id,
          email_from: data.email,
          code: code,
          expiresAt: codeExpiresAt,
        }
      });
    if (!storeCode) {
      throw new BadRequestException('Failed to store invite code');
    }

    return `Invitation sent successfully to ${data.email}`;
  } 

  async getUser(data: AuthGetInviteDto): Promise<any> {
    const {token} = data;
    if (!token){
      throw new BadRequestException('Token is required');
    }

    let decodedToken; 
    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }

    const emailInvitation = await this.prisma.emailInvitation.findFirst({
      where: {
        userId : decodedToken.id,
        code: token
      },
    })

    if (!emailInvitation){
      throw new NotFoundException('Token not found!')
    }

    const user = await this.prisma.uSER.findFirst({
      where: {
        id: decodedToken.id
      }
    })

    if(!user){
      throw new NotFoundException('User not found!');
    }

    return {
      email: user.email,
      role: user.role,
      companyName: user.organization_name,
    };
  }


  async invitedUserSignup(data: AuthinvitedUserSignupDto): Promise<string>{
    let decodedToken; 
    try {
      decodedToken = jwt.verify(data.token, process.env.JWT_SECRET);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
    //verify again if this token exists in our database: 
    const emailInvitation = await this.prisma.emailInvitation.findFirst({
      where: {
        userId : decodedToken.id,
        code: data.token
      },
    })
    if (!emailInvitation){
      throw new NotFoundException('Token not found!')
    }

    //find user in our database
    const user = await this.prisma.uSER.findFirst({
      where: {
        id: decodedToken.id
      }
    })
    if(!user){
      throw new NotFoundException('User not found');
    }

    const passwordCript = await bcrypt.hash(data.password, 10);
    //set password and update status to prospect
    const updatePass = await this.prisma.uSER.update({
      data: { 
        first_name: data.firstName,
        last_name: data.lastName,
        job_title: data.jobTitle,
        password: passwordCript,
        status: data.status
      },
      where: {id: decodedToken.id}
    })

    if (!updatePass){
      throw new BadRequestException('Error in set user password')
    }

    //Create a new JWT for keep the user logged in
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
        expiresAt: new Date(Date.now() +  Number(process.env.TOKEN_TIME_EXPIRED) || 60 * 60 * 1000), 
      }
    })

    if (!session) {
      throw new BadRequestException('Failed to create session');
    }
    return token;

  }

  async updatePassword(data: AuthUpdatePasswordDto, user):Promise<boolean>{
    const { oldPassword, password } = data;
    if (!oldPassword || !password) {
      throw new BadRequestException('Old password and new password are required');
    }

    const userDB = await this.prisma.uSER.findUnique({
      where: { id: user.id },
    })
    if(!userDB) throw new NotFoundException('User not found');

    const isMatch = await bcrypt.compare(oldPassword, userDB.password);
    if (!isMatch) throw new BadRequestException('Invalid old password');

    const hashedPassword = await bcrypt.hash(password, 10);
    const updatedUser = await this.prisma.uSER.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });
    return true;
  }
}
