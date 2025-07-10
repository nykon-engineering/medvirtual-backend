/* istanbul ignore file */
import { Body, Controller, Post } from '@nestjs/common';
import { RecoverypassService } from './recoverypass.service';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ResetPasswordDto } from './dto/resetPassword.dto';
import { forgotDto } from './dto/forgot.dto';

@Controller('recovery-pass')
@ApiTags('Recovery Password')   
export class RecoverypassController {

    constructor(
        private readonly recoverypassService: RecoverypassService,
    ){}

    @Post('forgot')
    @ApiOperation({ summary: 'Request a password recovery email' })
    @ApiBody({type: forgotDto})
    @ApiResponse({ status: 404, description: 'Email is required'})
    @ApiResponse({ status: 404, description: 'User with this email does not exist'})
    @ApiResponse({ status: 400, description: 'Error generating recovery hash'})
    @ApiResponse({ status: 400, description: 'Error sending recovery email'})
    @ApiResponse({ status: 200, description: 'Recovery password email sent successfully'})
    @ApiResponse({ status: 500, description: 'Recovery password failed'})
    async forgotPassword(@Body() email: forgotDto){
        console.log('Arriving in the controller: ', email);
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
        return { 
            status: 200,
            message: 'Password reset successfully, redirecting to login page',
         }
    }
}
