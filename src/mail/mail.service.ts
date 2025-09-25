import { BadRequestException, Injectable } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  
  async sendMail(options): Promise<boolean> {
    
    if (!process.env.RESEND_API_KEY) {
      throw new BadRequestException('RESEND_API_KEY is not set in environment variables');
    }

    if (!options || !options.from || !options.to || !options.subject || !options.html) {
      throw new BadRequestException('Invalid email options provided');
    }
    const resend = new Resend(process.env.RESEND_API_KEY);

    const result= await resend.emails.send({
      from: options.from,
      to: options.to,
      cc: options.cc,
      subject: options.subject,
      html: options.html,
    });

    if (!result) {
      throw new BadRequestException('Failed to send email');
    }

    return true; 
  }
}
