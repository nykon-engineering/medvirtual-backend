import { Body, Controller, Inject, Get, Query, Res } from '@nestjs/common';
import { UserService } from './user.service';
import { Prisma } from '@prisma/client';
import { WorkosService } from '../workos/workos.service';
import { Response } from 'express';

@Controller('user')
export class UserController {
    @Inject()
    private readonly userService: UserService;
    private readonly workosService: WorkosService;

    @Get('signup')
    async signUp(@Query('code') code: string, @Res() res: Response) {
        try{
            const profile = await this.workosService.getProfile(code);

            const payload = {
                id: profile.id,
                email: profile.email,
                firstName: profile.firstName,
            }

            //configurate JWT
            const token = '';

            res.redirect(`http://localhost:3000?token=${token}`);
        }catch (error) {   
            console.log('Error in auth:', error);
            res.status(500).send('Authentication failed');
        }
    }
}
