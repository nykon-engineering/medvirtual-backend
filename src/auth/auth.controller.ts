import { Body, Controller, Get, Inject, Param, Post, Query, Redirect, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AuthService } from './auth.service';

import { SignInDto } from './dto/SignIn.dto';
import { SignUpDto } from './dto/SignUp.dto';
import { stat } from 'fs';
import { LogoutDto } from './dto/logOut.dto';
import { signUpReturnDto } from './dto/signupReturn.dto';

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
    @ApiResponse({ status: 400, description: 'Code is required' })
    @ApiResponse({ status: 400, description: 'Failed to retrieve user profile from WorkOS' })
    @ApiResponse({ status: 400, description: 'Failed to create session' })
    @ApiResponse({ status: 200, description: 'User authenticated successfully' })
    @ApiResponse({ status: 500, description: 'Authentication failed' })
    async callback(@Query('code') code: string, @Res() res: Response){
        try{
            const token = await this.authService.handleUser(code);
            return {
                statusCode: 200,
                message: 'User authenticated successfully',
                token,
            };
        }catch (error) {
            return {
                statusCode: 500,
                message: 'Authentication failed'
            }
        }
    }

    @Get('workOs')
    @Redirect()
    @ApiOperation({ summary: 'Generate authorizationUrl from WorkOs' })
    @ApiResponse({ status: 200, description: 'Url generated succesfully' })
    @ApiResponse({ status: 500, description: 'Url generated failed' })
    async workOs() {
        const url = await this.authService.workOsSignIn();
        if (!url) {
            return {
                statusCode: 500,
                message: 'Authentication failed'
            }
        }
        return {
            statusCode: 302,
            url
        }
    }

    @Post('signin')
    @ApiOperation({ summary: 'SignIn from our own database' })
    @ApiResponse({ status: 200, description: 'User authenticated successfully' })
    @ApiResponse({ status: 401, description: 'User not found with this email' })
    @ApiResponse({ status: 401, description: 'User does not use this authentication method. You need to Sign in with the first method you have used' })
    @ApiResponse({ status: 401, description: 'User not verified' })
    @ApiResponse({ status: 400, description: 'Invalid Password' })
    @ApiResponse({ status: 400, description: 'Failed to create session' })
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
    @ApiOperation({ summary: 'SignUp from our own database' })
    @ApiResponse({ status: 400, description: 'User already exists with this email' })
    @ApiResponse({ status: 400, description: 'Failed to generate verification code' })
    @ApiResponse({ status: 400, description: 'Failed to store verification code' })
    @ApiResponse({ status: 200, description: 'Code sent successfully' })
    async signUp(@Body() data: SignUpDto) {

        const result = await this.authService.signUp(data);
        return {
            statusCode: 200,
            message: 'Code sent successfully',
            code: result.code,
            email: result.email
        }
    }

    @Post('verify-code')
    @Redirect()
    @ApiBody({ type: signUpReturnDto })
    @ApiOperation({ summary: 'Verify code for user registration' })
    @ApiResponse({ status: 302, description: 'User registered successfully', type: Redirect })
    @ApiResponse({ status: 400, description: 'Failed to verify code' })
    @ApiResponse({ status: 400, description: 'Code and email are required' })
    @ApiResponse({ status: 400, description: 'User not found with this email' })
    @ApiResponse({ status: 400, description: 'Invalid verification code' })
    @ApiResponse({ status: 400, description: 'Code already verified' })
    async verifyCode(@Body() data: signUpReturnDto) {
        const result = await this.authService.verifyCode(data);
        if (!result) {
            return {
                statusCode: 400,
                message: 'Failed to verify code'
            };
        }
        return {url: '/login'};
    }

    @Post('resend-code')
    @ApiOperation({ summary: 'Resend verification code to user email' })
    @ApiBody({ type: String })
    @ApiResponse({ status: 200, description: 'Code sent successfully' })
    @ApiResponse({ status: 400, description: 'Email is required' })
    @ApiResponse({ status: 400, description: 'User not found with this email' })
    @ApiResponse({ status: 400, description: 'Failed to invalidate previous verification code' })
    @ApiResponse({ status: 400, description: 'Failed to generate verification code' })
    async resendCode(@Body() email: string) {
        const result = await this.authService.resendCode(email);
        return {
            statusCode: 200,
            message: 'Code sent successfully',
            code: result.code,
            email: result.email
        }
    }


    @Post('logout')
    @Redirect()
    @ApiOperation({ summary: 'Logout user' })
    @ApiBody({ type: LogoutDto })
    @ApiResponse({ status: 302, description: 'User logged out successfully', type: Redirect })
    @ApiResponse({ status: 400, description: 'Token is required' })
    @ApiResponse({ status: 400, description: 'Failed to revoke token' })
    @ApiResponse({ status: 500, description: 'Failed to log out user' })
    async logout(@Body() token:string){
        const result = await this.authService.logout(token);
        if (result) {
            return {
                statusCode: 302,
                message: 'User logged out successfully',
                url: '/login'
            };
        } else {
            return {
                statusCode: 500,
                message: 'Failed to log out user'
            };
        }
    }

}
