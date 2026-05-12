import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EmailTestService } from './email-test.service';

@ApiTags('email-test')
@Controller('email-test')
export class EmailTestController {
  constructor(private readonly emailTestService: EmailTestService) {}

  @Get('verification-code')
  @ApiOperation({ summary: 'Send a test verification code email to verify the template renders correctly' })
  @ApiQuery({ name: 'theme', required: false, description: 'Email theme (medvirtual or berry)', example: 'medvirtual' })
  @ApiQuery({ name: 'berry', required: false, description: 'Use berry theme variant', example: 'true' })
  @ApiQuery({ name: 'email', required: false, description: 'Recipient email address', example: 'test@example.com' })
  @ApiResponse({ status: 200, description: 'Verification code email sent successfully' })
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
  @ApiOperation({ summary: 'Send a test invite signup email to verify the invitation template renders correctly' })
  @ApiQuery({ name: 'theme', required: false, description: 'Email theme (medvirtual or berry)', example: 'medvirtual' })
  @ApiQuery({ name: 'email', required: false, description: 'Recipient email address', example: 'test@example.com' })
  @ApiResponse({ status: 200, description: 'Invite signup email sent successfully' })
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
  @ApiOperation({ summary: 'Send a test reset password email to verify the template renders correctly' })
  @ApiQuery({ name: 'theme', required: false, description: 'Email theme (medvirtual or berry)', example: 'medvirtual' })
  @ApiQuery({ name: 'email', required: false, description: 'Recipient email address', example: 'test@example.com' })
  @ApiResponse({ status: 200, description: 'Reset password email sent successfully' })
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
  @ApiOperation({ summary: 'Send a test notification email to verify the notification template renders correctly' })
  @ApiQuery({ name: 'theme', required: false, description: 'Email theme (medvirtual or berry)', example: 'medvirtual' })
  @ApiQuery({ name: 'email', required: false, description: 'Recipient email address', example: 'test@example.com' })
  @ApiResponse({ status: 200, description: 'Notification email sent successfully' })
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
  @ApiOperation({ summary: 'Send all test email templates at once to verify all templates render correctly' })
  @ApiQuery({ name: 'theme', required: false, description: 'Email theme (medvirtual or berry)', example: 'medvirtual' })
  @ApiQuery({ name: 'email', required: false, description: 'Recipient email address', example: 'test@example.com' })
  @ApiResponse({ status: 200, description: 'All test emails sent successfully' })
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