import { Controller, Get, Param, Res, Query, Redirect } from '@nestjs/common';
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
        console.log('Tokens received:', tokens);
        return { 
            status: 200,
            message: 'Authentication successful! Tokens received.'
        };
    }

    @Get('/list-files/:folderId')
    async listFilesInFolder(folderId: string) {
        return this.googledriveService.listFilesInFolder(folderId);
    }

    @Get('download-file/:fileId')
    async downloadFile(@Param('fileId') fileId: string) {
        const destinationPath = `./downloads-resume/`;
        return this.googledriveService.downloadFile(fileId, destinationPath);
    }
}


