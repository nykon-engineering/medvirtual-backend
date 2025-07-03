import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { MailService } from '../mail/mail.service';
import { forgotDto } from './dto/forgot.dto';

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
        const hash = jwt.sign({id: user.id, email: user.email}, process.env.JWT_SECRET, {
            expiresIn: '10m',
        });

        if(!hash) {
            throw new BadRequestException('Error generating recovery hash');
        }

        //send email with the hash
        const emailSent = await this.mail.sendMail({
            to:user.email,
            subject: 'Authentication Code',
            text: `Email with the button with a link and hash: ${hash}`,
        })
        if(!emailSent) {
            throw new BadRequestException('Error sending recovery email');
        }
        
        return true;
    }
}
