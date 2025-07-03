import { Body, Controller, Post } from '@nestjs/common';
import { forgotDto } from './dto/forgot.dto';
import { RecoverypassService } from './recoverypass.service';
import { ApiBody, ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';

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
}
