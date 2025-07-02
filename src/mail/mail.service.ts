import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { SendMailOptions } from './interfaces/send-email.interface';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT,
      secure: process.env.MAIL_SECURE === 'true', // true para 465, false para outras portas
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });
  }
  

  async sendMail(options: SendMailOptions): Promise<void> {
    await this.transporter.sendMail({
      from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html, // opcional
    });
  }
}
