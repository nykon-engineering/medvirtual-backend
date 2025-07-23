import { Controller, Get, Param, Query, Redirect } from '@nestjs/common';
import { GoogledriveService } from './googledrive.service';



@Controller('googledrive')
export class GoogledriveController {
    constructor(
        private readonly googledriveService : GoogledriveService
    ){}

    @Get()
    @Redirect()
    async redirectToGoogle() {
        const url = await this.googledriveService.generateAuthUrl();
        return {url: url};
    }

    @Get('callback')
    async handleGoogleCallback(@Query('code') code: string) {
        const tokens = await this.googledriveService.getTokens(code);
        //return tokens;
        return { 
            status: 200,
            message: 'Authentication successful! Tokens received.'
        };
    }

}


