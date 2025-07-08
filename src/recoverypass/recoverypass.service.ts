import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs'; 

import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { MailService } from '../mail/mail.service';
import { forgotDto } from './dto/forgot.dto';
import { ResetPasswordDto } from './dto/resetPassword.dto';
import getResetPasswordTemplate from './../utils/email-templates/reset-password';

@Injectable()
export class RecoverypassService {

    constructor(
        private readonly user: UserService,
        private readonly prisma: PrismaService,
        private readonly mail: MailService
    ){}

    async forgotPassword(email: forgotDto): Promise<Boolean>{
        //check if the user exists with this email
        const user = await this.user.findByEmail(email.email);
        if (!user) {
            throw new NotFoundException('User with this email does not exist');
        }

        //create hash with the email and the current date with expiration time
        const hash = jwt.sign({id: user.id}, process.env.JWT_SECRET, {
            expiresIn: '10m',
        });

        if(!hash) {
            throw new BadRequestException('Error generating recovery hash');
        }

        
        // Send verification code via email
        const emailBody = getResetPasswordTemplate(user.first_name, `https://medvirtual.com/reset-password?hash=${hash}`);
        const mailSent = await this.mail.sendMail(
        {
        from: 'MedVirtual <onboarding@resend.dev>',
        to: user.email,
        subject: 'Reset Password',
        html: emailBody,
        });
    
        if(!mailSent) { 
        throw new BadRequestException('Error sending recovery email');
        }

        return true
        
    }


    async verifyCode(hash: string): Promise<Boolean> {
        if (!hash) {
            throw new NotFoundException('Hash is empty or not found');
        }
        //verify the hash validate
        try{
            const payload = jwt.verify(hash, process.env.JWT_SECRET);
            return true;
        }catch (error) {
            throw new BadRequestException('Hash is expired or invalid');
        }
    }

    async resetPassword(data: ResetPasswordDto): Promise<Boolean> {

        const { hash, newPassword } = data;
        if (!hash) {
            throw new BadRequestException('Hash is required');
        }
        if (!newPassword) {
            throw new BadRequestException('New password is required');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        //verify the hash validate
        try {
            const payload = jwt.verify(hash, process.env.JWT_SECRET);
            const userId = payload['id'];

            if (!userId) {
                throw new NotFoundException('User ID not found in hash');
            }
            //update the user password
            await this.prisma.user.update({
                where: { id: userId },
                data: { password: hashedPassword },
            });

            return true;
        } catch (error) {
            throw new BadRequestException('Hash is expired or invalid');
        }
    }
}
