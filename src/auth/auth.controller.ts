/* istanbul ignore file */
import { Body, Controller, Get, HttpCode, Inject, Post, Query, Redirect, Res, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

import { AuthService } from './auth.service';

import { AuthSignInDto } from './dto/authSignIn.dto';
import { AuthSignUpDto } from './dto/authSignUp.dto';
import { AuthLogoutDto } from './dto/authLogOut.dto';
import { AuthResendCodeDto } from './dto/authResendCode.dto';
import { AuthInviteUserDto } from './dto/authInviteUser.dto';
import { AuthVerifyCodeDto } from './dto/authVerifyCode.dto';
import { AuthSetPasswordDto } from './dto/authSetPassword.dto';
import { AuthGetInviteDto } from './dto/authGetInvite.dto';

import { AuthGuard } from './auth.guard';
import { CurrentUser } from './current-user.decorator';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { AuthGetInviteReturnDto } from './dto/authGetInviteReturn.dto';
import { USER } from '@prisma/client';


/*
    1.User is redirected to workOs for authentication.
    2.User login/register with the SSO chosed
    3.WorkOs redirects back to our backedn with a code.
    4.I use code to get user profile from Workos.
*/

@ApiTags('Auth')
@Controller('auth')
export class AuthController {

    constructor(private readonly authService: AuthService){}

    @Get('workos')
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
        return {url: url};
    }

    @Get('callback')
    @ApiOperation({ summary: 'Return from WorkOS for authentication' })
    @ApiResponse({ status: 400, description: 'Code is required' })
    @ApiResponse({ status: 400, description: 'Failed to retrieve user profile from WorkOS' })
    @ApiResponse({ status: 400, description: 'Failed to create session' })
    @ApiResponse({ status: 200, description: 'User authenticated successfully' })
    @ApiResponse({ status: 500, description: 'Authentication failed' })
    async callback(@Query('code') code: string, @Res({ passthrough: true }) res: Response) {
        const token = await this.authService.handleUser(code);   
        res.cookie('authToken', token, {
            httpOnly: true,
            secure: false,
            sameSite: 'none',
            maxAge: 60 * 60 * 1000, // 1 hora
        });
        res.redirect('http://localhost:8080/home');
    }
    

    @Post('signin')
    @HttpCode(200)
    @ApiBody({ type: AuthSignInDto })
    @ApiOperation({ summary: 'SignIn from our own database' })
    @ApiResponse({ status: 200, description: 'User authenticated successfully' })
    @ApiResponse({ status: 401, description: 'User not found with this email' })
    @ApiResponse({ status: 401, description: 'User does not use this authentication method. You need to Sign in with the first method you have used' })
    @ApiResponse({ status: 401, description: 'User not verified' })
    @ApiResponse({ status: 400, description: 'Invalid Password' })
    @ApiResponse({ status: 400, description: 'Failed to create session' })
    @ApiResponse({ status: 500, description: 'Authentication failed' })
    async signIn(@Body() data: AuthSignInDto) {
        const token = await this.authService.signIn(data);
        return {
            statusCode: 200,
            message: 'User authenticated successfully',
            token,
            };
    }


    @Post('signup')
    @HttpCode(201)
    @ApiBody({ type: AuthSignUpDto })
    @ApiOperation({ summary: 'SignUp from our own database' })
    @ApiResponse({ status: 400, description: 'User already exists with this email' })
    @ApiResponse({ status: 400, description: 'Failed to generate verification code' })
    @ApiResponse({ status: 400, description: 'Failed to store verification code' })
    @ApiResponse({ status: 201, description: 'Code sent successfully' })
    async signUp(@Body() data: AuthSignUpDto) {
        const result = await this.authService.signUp(data);
        return {
            statusCode: 201,
            message: 'Code sent successfully',
            token: result.token
        }
    }

    @Post('verify-code')
    @HttpCode(200)
    @ApiBody({ type: AuthVerifyCodeDto })
    @ApiOperation({ summary: 'Verify code for user registration' })
    @ApiResponse({ status: 302, description: 'User registered successfully'})
    @ApiResponse({ status: 400, description: 'Failed to verify code' })
    @ApiResponse({ status: 400, description: 'Code and token are required' })
    @ApiResponse({ status: 401, description: 'Invalid token' })
    @ApiResponse({ status: 400, description: 'User not found' })
    @ApiResponse({ status: 400, description: 'Invalid verification code' })
    @ApiResponse({ status: 400, description: 'Code already verified' })
    async verifyCode(@Body() data: AuthVerifyCodeDto) {
        const result = await this.authService.verifyCode(data);
        if (!result) {
            return {
                statusCode: 400,
                message: 'Failed to verify code'
            };
        }
        return {
            statusCode: 200,
            message: 'Code verified and User logged in successfully',
            token: result,
        };
    }

    @Post('resend-code')
    @HttpCode(200)
    @ApiBody({ type: AuthResendCodeDto })
    @ApiOperation({ summary: 'Resend verification code to user email' })
    @ApiResponse({ status: 200, description: 'Code sent successfully' })
    @ApiResponse({ status: 400, description: 'Email is required' })
    @ApiResponse({ status: 400, description: 'User not found with this email' })
    @ApiResponse({ status: 400, description: 'Failed to invalidate previous verification code' })
    @ApiResponse({ status: 400, description: 'Failed to generate verification code' })
    @ApiResponse({ status: 400, description: 'Failed to store verification code' })
    @ApiResponse({ status: 400, description: 'Failed to send verification email' })
    async resendCode(@Body() data: AuthResendCodeDto) {
        const result = await this.authService.resendCode(data);
        return {
            statusCode: 200,
            message: 'Code sent successfully',
            token: result.token
        }
    }


    @Post('logout')
    @HttpCode(302)
    @ApiBody({ type: AuthLogoutDto })
    @Redirect()
    @ApiOperation({ summary: 'Logout user' })
    @ApiResponse({ status: 302, description: 'User logged out successfully' })
    @ApiResponse({ status: 400, description: 'Token is required' })
    @ApiResponse({ status: 400, description: 'Failed to revoke token' })
    @ApiResponse({ status: 500, description: 'Failed to log out user' })
    async logout(@Body() data: AuthLogoutDto){
        const result = await this.authService.logout({token: data.token});
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

    @Post('invite')
    @HttpCode(201)
    @ApiBody({ type: AuthInviteUserDto })
    @UseGuards(AuthGuard, RolesGuard)
    @Roles('SuperAdmin')
    @ApiOperation({ summary: 'An admin invites a new user to the platform' })
    @ApiResponse({ status: 201, description: 'Invitation sent successfully to new.user@client.com.' })
    @ApiResponse({ status: 400, description: 'Failed to generate invite code' })
    @ApiResponse({ status: 400, description: 'Failed to send invitation email' })
    @ApiResponse({ status: 400, description: 'Failed to store invite code' })
    @ApiResponse({ status: 409, description: 'User already exists' })
    @ApiResponse({ status: 403, description: 'Access denied: insufficient permissions' })
    async inviteUser(@Body() data: AuthInviteUserDto, @CurrentUser() user : USER) {
        const result = await this.authService.inviteUser(data, user);
        if (result) {
            return {
                statusCode: 201,
                message: result
            };
        }
    }

    @Post('get-user')
    @HttpCode(200)
    @ApiBody({ type: AuthGetInviteDto })
    @ApiOperation({ summary: 'Get user data from email' })
    @ApiResponse({ status: 200, description: 'User data retrieved successfully' })
    @ApiResponse({ status: 400, description: 'Token is required' })
    @ApiResponse({ status: 400, description: 'Invalid Token' })
    @ApiResponse({ status: 404, description: 'Token not found' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async getInvite(@Body() data: AuthGetInviteDto) : Promise<any>{
        const user = await this.authService.getUser(data);
        return user;
    }

    @Post('set-password')
    @HttpCode(200)
    @ApiBody({ type: AuthSetPasswordDto })
    @ApiOperation({ summary: 'Allows a new uset to set their password using a valid invitation'})
    @ApiResponse({ status: 200, description: 'Password has been set successfully. You can now log in.' })
    @ApiResponse({ status: 400, description: 'Invalid token' })
    @ApiResponse({ status: 404, description: 'Token not found' })
    @ApiResponse({ status: 404, description: 'User not found' })
    @ApiResponse({ status: 400, description: 'Error in set user password' })
    async setPassword(@Body() data: AuthSetPasswordDto){
        const result = await this.authService.setPassword(data);
        return {
            statusCode: 200,
            message: "Password has been set successfully. You can now log in.",
            result: result
        }
    }


}
