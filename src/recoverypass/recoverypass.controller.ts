import { Body, Controller, Get, Param, Post, Redirect } from '@nestjs/common';
import { forgotDto } from './dto/forgot.dto';
import { RecoverypassService } from './recoverypass.service';
import { ApiBody, ApiOperation, ApiProperty, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ResetPasswordDto } from './dto/resetPassword.dto';

@Controller('recovery-pass')
@ApiTags('Recovery Password')   
export class RecoverypassController {

    constructor(
        private readonly recoverypassService: RecoverypassService,
    ){}

    @Post('forgot')
    @ApiOperation({ summary: 'Request a password recovery email' })
    @ApiBody({type: forgotDto})
    @ApiResponse({ status: 404, description: 'User with this email does not exist'})
    @ApiResponse({ status: 400, description: 'Error generating recovery hash'})
    @ApiResponse({ status: 400, description: 'Error sending recovery email'})
    @ApiResponse({ status: 200, description: 'Recovery password email sent successfully'})
    @ApiResponse({ status: 500, description: 'Recovery password failed'})
    async forgotPassword(@Body() email: forgotDto){
        const result = await this.recoverypassService.forgotPassword(email);
        if (!result) {
            return { status: 500, message: 'Recovery password failed' };
        }

        return {
            status: 200,
            message: 'Recovery password email sent successfully'
        }
    }

    @Get('verify/:hash')
    @ApiOperation({ summary: 'Verify the authentication code' })
    @ApiQuery({ name: 'hash', required: true, type: String, description: 'The authentication code hash' })
    @ApiResponse({ status: 404, description: 'Hash is empty or not found'})
    @ApiResponse({ status: 400, description: 'Hash is expired or invalid'})
    @ApiResponse({ status: 200, description: 'Recovery password successfully verified'})
    @ApiResponse({ status: 500, description: 'Recovery password failed'})
    async verifyCode(@Param('hash') hash: string) {
        const result = await this.recoverypassService.verifyCode(hash)

        if (!result) {
            return { status: 500, message: 'Recovery password failed' };
        }
        return {
            status: 200,
            message: 'Recovery password successfully verified'
        }
    }

    @Post('reset-password')
    @Redirect('/login')
    @ApiOperation({ summary: 'Reset the password using the authentication code' })
    @ApiBody({ type: ResetPasswordDto })
    @ApiResponse({ status: 400, description: 'Hash is required' })
    @ApiResponse({ status: 400, description: 'New password is required' })
    @ApiResponse({ status: 404, description: 'User ID not found in hash' })
    @ApiResponse({ status: 400, description: 'Hash is expired or invalid' })
    @ApiResponse({ status: 302, description: 'User redirected to /login page' })
    @ApiResponse({ status: 500, description: 'Recovery password failed' })
    async resetPassword(@Body() data: ResetPasswordDto) {
        const result = await this.recoverypassService.resetPassword(data);
        if (!result) {
            return { status: 500, message: 'Recovery password failed' };
        }
        return { url: '/login' }
    }
}
