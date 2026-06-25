import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

interface MailOptions {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  cc?: string | string[];
  bcc?: string | string[];
  headers?: Record<string, string>;
  tags?: { name: string; value: string }[];
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  private applyDevPrefix(from: string): string {
    const isProduction = process.env.ENVIRONMENT === 'PROD';
    return isProduction ? from : `[DEV] ${from}`;
  }

  async sendMail(options: MailOptions): Promise<boolean> {
    try {
      if (!process.env.RESEND_API_KEY) {
        throw new BadRequestException(
          'RESEND_API_KEY is not set in environment variables',
        );
      }

      if (
        !options ||
        !options.from ||
        !options.to ||
        !options.subject ||
        !options.html
      ) {
        throw new BadRequestException('Invalid email options provided');
      }

      const resend = new Resend(process.env.RESEND_API_KEY);

      const emailData = {
        from: this.applyDevPrefix(options.from),
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        subject: options.subject,
        html: options.html,
        headers: options.headers || {},
        tags: options.tags || [
          { name: 'type', value: 'general' },
          { name: 'source', value: 'medvirtual' },
        ],
      };

      const result = await resend.emails.send(emailData);

      if (!result || !result.data) {
        this.logger.error(
          `Failed to send email to ${options.to}: ${result?.error?.message || 'Unknown error'}`,
        );
        throw new BadRequestException('Failed to send email');
      }

      this.logger.log(
        `Email sent successfully to ${options.to} with ID: ${result.data.id}`,
      );
      return true;
    } catch (error) {
      this.logger.error(`Error sending email to ${options.to}:`, error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(`Failed to send email: ${error.message}`);
    }
  }
}
