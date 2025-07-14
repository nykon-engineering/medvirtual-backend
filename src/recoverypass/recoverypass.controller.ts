/* istanbul ignore file */
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { RecoverypassService } from './recoverypass.service';

import { RecoveryForgotPasswordDto } from './dto/recoveryForgotPassword.dto';
import { RecoveryResetPasswordDto } from './dto/recoveryResetPassword.dto';

@Controller('recovery-pass')
@ApiTags('Recovery Password')   
export class RecoverypassController {
    
    constructor(
        private readonly recoverypassService: RecoverypassService,
    ){}

    @Post('forgot')
    @HttpCode(200)
    @ApiBody({ type: RecoveryForgotPasswordDto})
    @ApiOperation({ summary: 'Request a password recovery email' })
    @ApiResponse({ status: 400, description: 'Email is required'})
    @ApiResponse({ status: 404, description: 'User with this email does not exist'})
    @ApiResponse({ status: 400, description: 'Error generating recovery hash'})
    @ApiResponse({ status: 400, description: 'Error sending recovery email'})
    @ApiResponse({ status: 200, description: 'Recovery password email sent successfully'})
    @ApiResponse({ status: 500, description: 'Recovery password failed'})
    async forgotPassword(@Body() email: RecoveryForgotPasswordDto){
        const result = await this.recoverypassService.forgotPassword(email);
        if (!result) {
            return { status: 500, message: 'Recovery password failed' };
        }
        return {
            status: 200,
            message: 'Recovery password email sent successfully'
        }
    }

    @Post('set-password')
    @HttpCode(200)
    @ApiBody({ type: RecoveryResetPasswordDto })
    @ApiOperation({ summary: 'Reset the password using the authentication code' })
    @ApiResponse({ status: 400, description: 'Hash is required' })
    @ApiResponse({ status: 400, description: 'New password is required' })
    @ApiResponse({ status: 404, description: 'User ID not found in hash' })
    @ApiResponse({ status: 400, description: 'Hash is expired or invalid' })
    @ApiResponse({ status: 200, description: 'Password reset successfully, redirecting to login page' })
    @ApiResponse({ status: 500, description: 'Recovery password failed' })
    async setPassword(@Body() data: RecoveryResetPasswordDto) {
        const result = await this.recoverypassService.setPassword(data);  
        if (!result) {
            return { status: 500, message: 'Recovery password failed' };
        }
        return { 
            status: 200,
            message: 'Password reset successfully, redirecting to login page',
        }
    }
}
