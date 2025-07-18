import { Controller, Get, Param, Res, Query } from '@nestjs/common';
import { GoogledriveService } from './googledrive.service';
import { Response } from 'express';

@Controller('googledrive')
export class GoogledriveController {
    constructor(
        private readonly googledriveService : GoogledriveService
    ){}

    @Get()
    async redirectToGoogle(@Res() res: Response) {
        const url = await this.googledriveService.generateAuthUrl();
        return res.redirect(url);
    }

    @Get('callback')
    async handleGoogleCallback(@Query('code') code: string) {
        const tokens = await this.googledriveService.getTokens(code);
        return tokens;
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


