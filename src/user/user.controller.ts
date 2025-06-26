import { Body, Controller, Inject, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';

import { UserService } from './user.service';

/*
    1.User is redirected to workOs for authentication.
    2.User login/register with the SSO chosed
    3.WorkOs redirects back to our backedn with a code.
    4.I use code to get user profile from Workos.
*/

@Controller('user')
export class UserController {
    @Inject()
    private readonly userService: UserService;

    @Get('workOsCallback')
    async workOsCallback(@Query('code') code: string, @Res() res: Response){
        try{
            const token = await this.userService.handleUser(code);
            return res.status(200).json({  
                message: 'User authenticated successfully',
                token: token,
            });
        }catch (error) {
            console.error('Authentication Error:', error);
            return res.status(500).send('Authentication failed');
        }
    }

}
