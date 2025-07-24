import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs'; 

import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { MailService } from '../mail/mail.service';
import { RecoveryForgotPasswordDto } from './dto/recoveryForgotPassword.dto';
import getResetPasswordTemplate from '../utils/email-templates/reset-password';
import { RecoveryResetPasswordDto } from './dto/recoveryResetPassword.dto';

@Injectable()
export class RecoverypassService {

    constructor(
        private readonly user: UserService,
        private readonly prisma: PrismaService,
        private readonly mail: MailService
    ){}

    async forgotPassword(email: RecoveryForgotPasswordDto): Promise<Boolean>{
        //check if the user exists with this email
        if (!email || !email.email) {
            throw new BadRequestException('Email is required');
        }
        const user = await this.user.findByEmail(email.email);
        if (!user) {
            throw new NotFoundException('User with this email does not exist');
        }

        //create hash with the email and the current date with expiration time
        const hash = jwt.sign({id: user.id}, process.env.JWT_SECRET, {
            expiresIn: '10m',
        });

        if(!hash) throw new BadRequestException('Error generating recovery hash');
        
        // Send verification code via email
        const emailBody = getResetPasswordTemplate(user.first_name, `https://medvirtual.com/set-password?t=${hash}`);
        const mailSent = await this.mail.sendMail(
        {
        from: 'MedVirtual <noreply@medvirtual.ai>',
        to: user.email,
        subject: 'Reset Password',
        html: emailBody,
        });
    
        if(!mailSent) throw new BadRequestException('Error sending recovery email');
        
        return true
    }

    async setPassword(data: RecoveryResetPasswordDto): Promise<Boolean> {
        const { token, password } = data;
        if (!token) throw new BadRequestException('Hash is required');
        if (!password) throw new BadRequestException('New password is required');

        const hashedPassword = await bcrypt.hash(password, 10);
        
        //verify the hash validate
        try {
            const payload = jwt.verify(token, process.env.JWT_SECRET);
            const userId = payload['id'];

            if (!userId) throw new NotFoundException('User ID not found in hash');
            //update the user password
            await this.prisma.uSER.update({
                where: { id: userId },
                data: { password: hashedPassword },
            });

            return true;
        } catch (error) {
            throw new BadRequestException('Hash is expired or invalid');
        }
    }
}
