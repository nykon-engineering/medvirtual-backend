import { Controller, Get, Query } from '@nestjs/common';
import { EmailTestService } from './email-test.service';

@Controller('email-test')
export class EmailTestController {
  constructor(private readonly emailTestService: EmailTestService) {}

  @Get('verification-code')
  async testVerificationCode(
    @Query('theme') theme?: string,
    @Query('berry') berry?: string,
    @Query('email') email?: string
  ) {
    return this.emailTestService.testVerificationCode(
      theme || 'medvirtual',
      berry === 'true',
      email || 'test@example.com'
    );
  }

  @Get('invite-signup')
  async testInviteSignup(
    @Query('theme') theme?: string,
    @Query('email') email?: string
  ) {
    return this.emailTestService.testInviteSignup(
      theme || 'medvirtual',
      email || 'test@example.com'
    );
  }

  @Get('reset-password')
  async testResetPassword(
    @Query('theme') theme?: string,
    @Query('email') email?: string
  ) {
    return this.emailTestService.testResetPassword(
      theme || 'medvirtual',
      email || 'test@example.com'
    );
  }

  @Get('notification')
  async testNotification(
    @Query('theme') theme?: string,
    @Query('email') email?: string
  ) {
    return this.emailTestService.testNotification(
      theme || 'medvirtual',
      email || 'test@example.com'
    );
  }

  @Get('all')
  async testAllTemplates(
    @Query('theme') theme?: string,
    @Query('email') email?: string
  ) {
    return this.emailTestService.testAllTemplates(
      theme || 'medvirtual',
      email || 'test@example.com'
    );
  }
}