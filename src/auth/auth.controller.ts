import { Body, Controller, Get, Inject, Param, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AuthService } from './auth.service';

import { SignInDto } from './dto/SignIn.dto';

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

    @Get('workOs')
    @ApiOperation({ summary: 'Generate authorizationUrl from WorkOs' })
    @ApiResponse({ status: 200, description: 'Url generated succesfully' })
    @ApiResponse({ status: 500, description: 'Url generated failed' })
    async workOs(@Res() res: Response) {
        const url = await this.authService.workOsSignIn();
        if (!url) {
            return res.status(500).send('Failed to generate authorization URL');
        }
        return res.redirect(url);
    }

    @Post('signin')
    @ApiOperation({ summary: 'SignIn from our own database' })
    @ApiResponse({ status: 200, description: 'User authenticated successfully' })
    @ApiResponse({ status: 401, description: 'User not found with this email' })
    @ApiResponse({ status: 401, description: 'Signin method is wrong' })
    @ApiResponse({ status: 400, description: 'Invalid Password' })
    @ApiResponse({ status: 500, description: 'Authentication failed' })
    async signIn(@Body() data: SignInDto) {
        
    const token = await this.authService.signIn(data);
    return {
        statusCode: 200,
        message: 'User authenticated successfully',
        token,
        };
    }

    @Post('signup')
    async signUp(@Body() data: SignInDto) {

        const code = await this.authService.signUp(data);
        return {
            statusCode: 200,
            message: 'Code sent successfully',
            code,
        };
    }

}
