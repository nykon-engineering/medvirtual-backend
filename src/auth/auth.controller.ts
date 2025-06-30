import { Controller, Get, Inject, Param, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';

import { AuthService } from './auth.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

/*
    1.User is redirected to workOs for authentication.
    2.User login/register with the SSO chosed
    3.WorkOs redirects back to our backedn with a code.
    4.I use code to get user profile from Workos.
*/

@ApiTags('Auth')
@Controller('auth')
export class AuthController {

    @Inject()
    private readonly authService: AuthService

    @Get('test')
    @ApiOperation({ summary: 'Route for test the ser' })
    async test(){
        return { message: 'Auth endpoint is working' };
    }

    @Get('callback')
    @ApiOperation({ summary: 'Return from WorkOS for authentication' })
    @ApiResponse({ status: 200, description: 'User authenticated successfully' })
    @ApiResponse({ status: 500, description: 'Authentication failed' })
    async callback(@Query('code') code: string, @Res() res: Response){
        console.log('Received code:', code);
        try{
            const token = await this.authService.handleUser(code);
            return res.status(200).json({  
                message: 'User authenticated successfully',
                token: token,
            });
        }catch (error) {
            console.error('Authentication Error:', error);
            return res.status(500).send('Authentication failed');
        }
    }

    @Get('signIn')
    @ApiOperation({ summary: 'Generate authorizationUrl from WorkOs' })
    @ApiResponse({ status: 200, description: 'Url generated succesfully' })
    @ApiResponse({ status: 500, description: 'Url generated failed' })
    async signIn(@Res() res: Response) {
        const url = await this.authService.signIn();
        if (!url) {
            return res.status(500).send('Failed to generate authorization URL');
        }
        return res.redirect(url);
    }

}
